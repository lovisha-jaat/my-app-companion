import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ruleX System Prompt - Indian Laws and Finance AI Agent
const RULEX_SYSTEM_PROMPT = `You are ruleX, an AI agent for Indian laws and finance.

ROLE:
Provide accurate information on Indian laws, GST, taxation, and finance.

KNOWLEDGE USAGE:
• Use ONLY the knowledge provided in the CONTEXT section below.
• Do NOT use general AI knowledge or assumptions.
• Do NOT guess or infer missing information.

BEHAVIOR:
• Answer only when exact, verified information exists in the provided context.
• Always mention Act name and Section/Rule number when applicable.
• Keep legal wording accurate and unchanged.
• Be factual, neutral, and professional.
• When citing from documents, mention the source document filename.

REFUSAL RULE:
If the answer is not clearly available in the provided context, respond ONLY with:
❌ No official government data is available for this query at the moment.

TONE:
Formal, precise, and authoritative.

OUTPUT:
• Clear and concise response
• Structured sentences
• No opinions, no advice, no speculation
• Include source citations when using context`;

// Input validation constants
const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 2000;

interface ClassificationResult {
  domain: "finance" | "gst" | "civil" | "criminal" | "other";
  queryType: "informational" | "decision" | "document";
  confidence: "high" | "medium" | "low";
  keywords: string[];
}

interface GenerateRequest {
  query: string;
  classification: ClassificationResult;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  document_filename?: string;
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
    console.error("Embedding error:", await response.text());
    return [];
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required", code: "AUTH_REQUIRED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session", code: "AUTH_INVALID" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    const body: GenerateRequest = await req.json();
    const { query, classification, conversationHistory = [] } = body;

    // Input validation - check type
    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Query is required", code: "QUERY_MISSING" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Input validation - trim and check length
    const trimmedQuery = query.trim();
    
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      return new Response(
        JSON.stringify({ 
          error: `Query must be at least ${MIN_QUERY_LENGTH} characters`, 
          code: "QUERY_TOO_SHORT" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (trimmedQuery.length > MAX_QUERY_LENGTH) {
      return new Response(
        JSON.stringify({ 
          error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`, 
          code: "QUERY_TOO_LONG" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate classification if provided
    if (!classification || !classification.domain || !classification.queryType) {
      return new Response(
        JSON.stringify({ error: "Valid classification is required", code: "CLASSIFICATION_MISSING" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable", code: "SERVICE_ERROR" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // RAG: Search for relevant document chunks
    let contextChunks: DocumentChunk[] = [];
    let contextText = "";
    
    try {
      const queryEmbedding = await generateEmbedding(trimmedQuery, LOVABLE_API_KEY);
      
      if (queryEmbedding.length > 0) {
        const { data: chunks, error: searchError } = await supabase
          .rpc("match_document_chunks", {
            query_embedding: JSON.stringify(queryEmbedding),
            match_threshold: 0.65,
            match_count: 5,
            p_user_id: userId,
          });

        if (!searchError && chunks && chunks.length > 0) {
          // Get document filenames
          const documentIds = [...new Set(chunks.map((c: DocumentChunk) => c.document_id))];
          const { data: docs } = await supabase
            .from("documents")
            .select("id, filename")
            .in("id", documentIds);
          
          const docMap = docs ? Object.fromEntries(docs.map(d => [d.id, d.filename])) : {};
          
          contextChunks = chunks.map((chunk: DocumentChunk) => ({
            ...chunk,
            document_filename: docMap[chunk.document_id] || "Unknown",
          }));

          // Build context text
          contextText = contextChunks
            .map((c, i) => `[Source ${i + 1}: ${c.document_filename}]\n${c.content}`)
            .join("\n\n---\n\n");
        }
      }
    } catch (ragError) {
      console.error("RAG search error:", ragError);
      // Continue without context - will trigger refusal response
    }

    // Build context message with classification info and retrieved context
    let contextMessage = `Query Classification:
- Domain: ${classification.domain.toUpperCase()}
- Query Type: ${classification.queryType}
- Confidence: ${classification.confidence}
- Keywords: ${classification.keywords.join(", ")}

`;

    if (contextText) {
      contextMessage += `CONTEXT FROM VERIFIED DOCUMENTS:
${contextText}

---

`;
    } else {
      contextMessage += `CONTEXT: No verified documents found for this query.

`;
    }

    contextMessage += `User Query: ${trimmedQuery}`;

    // Build messages array with conversation history
    const messages = [
      { role: "system", content: RULEX_SYSTEM_PROMPT },
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: contextMessage },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        temperature: 0.1, // Low temperature for factual, consistent responses
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later.", code: "RATE_LIMIT" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service quota exceeded. Please try again later.", code: "QUOTA_EXCEEDED" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      return new Response(
        JSON.stringify({ error: "Unable to process your query. Please try again.", code: "PROCESSING_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      console.error("Invalid AI response structure:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Unable to generate response. Please try again.", code: "RESPONSE_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        classification,
        query: trimmedQuery,
        sourcesUsed: contextChunks.length,
        sources: contextChunks.map(c => ({
          filename: c.document_filename,
          similarity: c.similarity,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Response generation error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Unable to process your query. Please try again.", 
        code: "INTERNAL_ERROR" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
