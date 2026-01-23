import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://id-preview--d30362a9-9f2d-4032-855c-aa87685be3dc.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Generate embeddings using Lovable AI Gateway
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

interface SearchRequest {
  query: string;
  matchThreshold?: number;
  matchCount?: number;
}

interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required", code: "AUTH_REQUIRED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Service unavailable", code: "SERVICE_ERROR" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid session", code: "AUTH_INVALID" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    const body: SearchRequest = await req.json();
    const { query, matchThreshold = 0.7, matchCount = 5 } = body;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Valid query required", code: "QUERY_INVALID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query.trim(), lovableApiKey);

    // Search for matching chunks using the database function
    const { data: chunks, error: searchError } = await supabase
      .rpc("match_document_chunks", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: matchThreshold,
        match_count: matchCount,
        p_user_id: userId,
      });

    if (searchError) {
      console.error("Search error:", searchError);
      return new Response(
        JSON.stringify({ error: "Search failed", code: "SEARCH_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get document info for each chunk
    const documentIds = [...new Set((chunks || []).map((c: DocumentChunk) => c.document_id))];
    
    let documents: Record<string, { filename: string }> = {};
    if (documentIds.length > 0) {
      const { data: docs } = await supabase
        .from("documents")
        .select("id, filename")
        .in("id", documentIds);
      
      if (docs) {
        documents = Object.fromEntries(docs.map((d) => [d.id, { filename: d.filename }]));
      }
    }

    // Enrich chunks with document info
    const enrichedChunks = (chunks || []).map((chunk: DocumentChunk) => ({
      ...chunk,
      document_filename: documents[chunk.document_id]?.filename || "Unknown",
    }));

    return new Response(
      JSON.stringify({
        chunks: enrichedChunks,
        query: query.trim(),
        totalFound: enrichedChunks.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Search documents error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
