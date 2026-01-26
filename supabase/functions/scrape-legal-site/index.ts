import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known official legal sites that can be scraped
const ALLOWED_DOMAINS = [
  "indiacode.nic.in",
  "cbic.gov.in",
  "gst.gov.in",
  "incometaxindia.gov.in",
  "mca.gov.in",
  "legislative.gov.in",
  "doj.gov.in",
  "egazette.nic.in",
  "lawmin.gov.in",
];

function isAllowedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ALLOWED_DOMAINS.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

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

// Note: Embeddings are not generated as the AI gateway doesn't support embedding models
// Content will be stored without embeddings and can be searched via text matching

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, scrapeType = "page" } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the domain is an official government legal site
    if (!isAllowedDomain(url)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Only official government legal sites are allowed for scraping to ensure data accuracy" 
        }),
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
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

    console.log(`Scraping ${url} for user ${user.id}`);

    // Use Firecrawl to scrape the page
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000, // Wait for dynamic content
      }),
    });

    const firecrawlData = await firecrawlResponse.json();

    if (!firecrawlResponse.ok || !firecrawlData.success) {
      console.error('Firecrawl error:', firecrawlData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: firecrawlData.error || "Failed to scrape the page" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const content = firecrawlData.data?.markdown || firecrawlData.markdown;
    const metadata = firecrawlData.data?.metadata || firecrawlData.metadata || {};

    if (!content || content.length < 100) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No meaningful content extracted from the page" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Extracted ${content.length} characters from ${url}`);

    // Create a document record for the scraped content
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const pageTitle = metadata.title || new URL(formattedUrl).pathname.split('/').pop() || 'Scraped Page';
    
    const { data: document, error: docError } = await serviceClient
      .from("documents")
      .insert({
        user_id: user.id,
        filename: `${pageTitle.substring(0, 100)}.md`,
        file_path: formattedUrl,
        status: "processing",
        mime_type: "text/markdown",
        file_size: content.length,
      })
      .select()
      .single();

    if (docError) {
      console.error("Failed to create document:", docError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save scraped content" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chunk and embed the content
    const chunks = chunkText(content);
    console.log(`Created ${chunks.length} chunks`);

    const chunkRecords: Array<{
      document_id: string;
      user_id: string;
      content: string;
      chunk_index: number;
      metadata: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      chunkRecords.push({
        document_id: document.id,
        user_id: user.id,
        content: chunk,
        chunk_index: i,
        metadata: {
          source_url: formattedUrl,
          page_title: pageTitle,
          source_type: "web_scrape",
          domain: new URL(formattedUrl).hostname,
          chunk_of: chunks.length,
        },
      });
    }

    if (chunkRecords.length === 0) {
      await serviceClient
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);

      return new Response(
        JSON.stringify({ success: false, error: "Failed to process content" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert chunks in batches
    const batchSize = 20;
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);
      const { error: insertError } = await serviceClient
        .from("document_chunks")
        .insert(batch);

      if (insertError) {
        console.error("Chunk insert error:", insertError);
      }
    }

    // Update document status
    await serviceClient
      .from("documents")
      .update({ status: "processed" })
      .eq("id", document.id);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          document_id: document.id,
          title: pageTitle,
          chunks_created: chunkRecords.length,
          source_url: formattedUrl,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to scrape" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
