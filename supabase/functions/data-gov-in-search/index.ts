import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Data.gov.in API base URL
const DATA_GOV_API = "https://api.data.gov.in/resource";

function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  while (start < cleanedText.length) {
    let end = start + chunkSize;
    
    if (end < cleanedText.length) {
      const searchStart = Math.max(end - 100, start);
      const searchText = cleanedText.slice(searchStart, end + 100);
      
      const paragraphBreak = searchText.lastIndexOf('\n\n');
      if (paragraphBreak > 0) {
        end = searchStart + paragraphBreak + 2;
      } else {
        const sentenceEnd = searchText.lastIndexOf('. ');
        if (sentenceEnd > 0) {
          end = searchStart + sentenceEnd + 2;
        }
      }
    }
    
    const chunk = cleanedText.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }
    
    start = end - overlap;
    if (start >= cleanedText.length) break;
  }
  
  return chunks;
}

interface DataGovResource {
  index_name: string;
  title: string;
  desc: string;
  org_type: string;
  org: string[];
  sector: string[];
  source: string;
  catalog_uuid: string;
  visualizable: string;
  active: string;
  created: number;
  updated: number;
  created_date: string;
  updated_date: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, resourceId, limit = 10, offset = 0, ingestToKnowledgeBase = false } = await req.json();

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const dataGovApiKey = Deno.env.get("DATA_GOV_IN_API_KEY");

    if (!dataGovApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Data.gov.in API key not configured. Please add DATA_GOV_IN_API_KEY secret.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Data.gov.in request for user ${user.id}`);

    // If resourceId is provided, fetch data from that specific resource
    if (resourceId) {
      const resourceUrl = `${DATA_GOV_API}/${resourceId}?api-key=${dataGovApiKey}&format=json&limit=${limit}&offset=${offset}`;
      
      console.log(`Fetching resource: ${resourceId}`);
      
      const response = await fetch(resourceUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Data.gov.in API error:", errorText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Failed to fetch data from data.gov.in",
            details: response.status === 401 ? "Invalid API key" : errorText,
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      
      // If ingest is requested, store the data
      if (ingestToKnowledgeBase && data.records && data.records.length > 0) {
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

        // Convert records to text format
        const textContent = data.records.map((record: Record<string, unknown>, idx: number) => {
          return `Record ${idx + 1}:\n${Object.entries(record).map(([key, value]) => `${key}: ${value}`).join('\n')}`;
        }).join('\n\n---\n\n');

        // Create document
        const docTitle = data.index_name || `Data.gov.in Resource ${resourceId}`;
        const { data: document, error: docError } = await serviceClient
          .from("documents")
          .insert({
            user_id: user.id,
            filename: `${docTitle.substring(0, 100)}.txt`,
            file_path: `https://data.gov.in/resource/${resourceId}`,
            status: "processing",
            mime_type: "text/plain",
            file_size: textContent.length,
          })
          .select()
          .single();

        if (docError) {
          console.error("Failed to create document:", docError);
        } else {
          // Chunk and store
          const chunks = chunkText(textContent);
          const chunkRecords = chunks.map((chunk, i) => ({
            document_id: document.id,
            user_id: user.id,
            content: chunk,
            chunk_index: i,
            metadata: {
              source_url: `https://data.gov.in/resource/${resourceId}`,
              title: docTitle,
              source_type: "data_gov_in",
              resource_id: resourceId,
              total_records: data.total,
              chunk_of: chunks.length,
            },
          }));

          const { error: insertError } = await serviceClient
            .from("document_chunks")
            .insert(chunkRecords);

          if (!insertError) {
            await serviceClient
              .from("documents")
              .update({ status: "processed" })
              .eq("id", document.id);
          } else {
            await serviceClient
              .from("documents")
              .update({ status: "failed" })
              .eq("id", document.id);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            index_name: data.index_name,
            title: data.title,
            description: data.desc,
            org: data.org,
            sector: data.sector,
            source: data.source,
            total: data.total,
            records: data.records,
            ingested: ingestToKnowledgeBase,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Search for resources/catalogs - Data.gov.in catalog search
    // Note: Data.gov.in doesn't have a direct search API for catalogs via API
    // Users need to find resource IDs from the website
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message: "Data.gov.in requires specific resource IDs to fetch data.",
          instructions: [
            "1. Visit https://data.gov.in/catalogs",
            "2. Search for the dataset you need",
            "3. Click on a dataset and find the API endpoint",
            "4. Copy the resource ID from the URL",
            "5. Use that resource ID to fetch data"
          ],
          example_resources: [
            { id: "9ef84268-d588-465a-a308-a864a43d0070", name: "Pin Code Directory" },
            { id: "6176ee09-3d56-4a3b-8115-21841576b2f6", name: "RBI - Bank Branch Directory" },
          ],
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Data.gov.in error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Request failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
