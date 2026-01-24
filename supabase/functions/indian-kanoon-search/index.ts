import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Indian Kanoon API base URL
const INDIAN_KANOON_API = "https://api.indiankanoon.org";

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

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Embedding error:", error);
    throw new Error("Failed to generate embedding");
  }

  const data = await response.json();
  return data.data[0].embedding;
}

interface IndianKanoonResult {
  tid: string;
  title: string;
  headline?: string;
  docsource?: string;
  publishdate?: string;
  citation?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, pagenum = 0, ingestToKnowledgeBase = false } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: "Search query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const indianKanoonApiKey = Deno.env.get("INDIAN_KANOON_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

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

    console.log(`Indian Kanoon search: "${query}" for user ${user.id}`);

    // If Indian Kanoon API key is not configured, use web scraping as fallback
    if (!indianKanoonApiKey) {
      console.log("Indian Kanoon API key not configured, using fallback search");
      
      // Return a message indicating the API is not configured
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            results: [],
            message: "Indian Kanoon API not configured. Please add INDIAN_KANOON_API_KEY secret or use web scraping for indiacode.nic.in instead.",
            alternative: "You can scrape official sites like indiacode.nic.in directly using the scrape-legal-site function.",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Make request to Indian Kanoon API
    const searchUrl = `${INDIAN_KANOON_API}/search/?formInput=${encodeURIComponent(query)}&pagenum=${pagenum}`;
    
    const searchResponse = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Authorization": `Token ${indianKanoonApiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("Indian Kanoon API error:", errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to search Indian Kanoon",
          details: searchResponse.status === 401 ? "Invalid API key" : errorText,
        }),
        { status: searchResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchData = await searchResponse.json();
    const results: IndianKanoonResult[] = searchData.docs || [];

    console.log(`Found ${results.length} results from Indian Kanoon`);

    // If ingestToKnowledgeBase is true, fetch full documents and add to knowledge base
    if (ingestToKnowledgeBase && results.length > 0 && lovableApiKey) {
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

      const ingestedDocs: string[] = [];

      // Limit to first 5 documents for ingestion
      const docsToIngest = results.slice(0, 5);

      for (const result of docsToIngest) {
        try {
          // Fetch full document
          const docResponse = await fetch(`${INDIAN_KANOON_API}/doc/${result.tid}/`, {
            headers: {
              "Authorization": `Token ${indianKanoonApiKey}`,
            },
          });

          if (!docResponse.ok) continue;

          const docData = await docResponse.json();
          const fullText = docData.doc || "";

          if (fullText.length < 100) continue;

          // Create document record
          const docTitle = result.title || `Indian Kanoon Doc ${result.tid}`;
          const { data: document, error: docError } = await serviceClient
            .from("documents")
            .insert({
              user_id: user.id,
              filename: `${docTitle.substring(0, 100)}.txt`,
              file_path: `https://indiankanoon.org/doc/${result.tid}/`,
              status: "processing",
              mime_type: "text/plain",
              file_size: fullText.length,
            })
            .select()
            .single();

          if (docError) {
            console.error("Failed to create document:", docError);
            continue;
          }

          // Chunk and embed
          const chunks = chunkText(fullText);
          const chunkRecords: Array<{
            document_id: string;
            user_id: string;
            content: string;
            chunk_index: number;
            embedding: string;
            metadata: Record<string, unknown>;
          }> = [];

          for (let i = 0; i < chunks.length; i++) {
            try {
              const embedding = await generateEmbedding(chunks[i], lovableApiKey);
              
              chunkRecords.push({
                document_id: document.id,
                user_id: user.id,
                content: chunks[i],
                chunk_index: i,
                embedding: JSON.stringify(embedding),
                metadata: {
                  source_url: `https://indiankanoon.org/doc/${result.tid}/`,
                  title: docTitle,
                  source_type: "indian_kanoon",
                  citation: result.citation,
                  docsource: result.docsource,
                  publishdate: result.publishdate,
                  chunk_of: chunks.length,
                },
              });
            } catch (e) {
              console.error(`Embedding error for chunk ${i}:`, e);
            }
          }

          if (chunkRecords.length > 0) {
            // Insert chunks
            const { error: insertError } = await serviceClient
              .from("document_chunks")
              .insert(chunkRecords);

            if (!insertError) {
              await serviceClient
                .from("documents")
                .update({ status: "processed" })
                .eq("id", document.id);
              
              ingestedDocs.push(docTitle);
            } else {
              await serviceClient
                .from("documents")
                .update({ status: "failed" })
                .eq("id", document.id);
            }
          }
        } catch (e) {
          console.error("Error ingesting document:", e);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            results: results.map(r => ({
              id: r.tid,
              title: r.title,
              headline: r.headline,
              source: r.docsource,
              date: r.publishdate,
              citation: r.citation,
              url: `https://indiankanoon.org/doc/${r.tid}/`,
            })),
            ingested: ingestedDocs,
            total_results: searchData.numfound || results.length,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return search results without ingestion
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          results: results.map(r => ({
            id: r.tid,
            title: r.title,
            headline: r.headline,
            source: r.docsource,
            date: r.publishdate,
            citation: r.citation,
            url: `https://indiankanoon.org/doc/${r.tid}/`,
          })),
          total_results: searchData.numfound || results.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Indian Kanoon search error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Search failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
