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

// Text-based search using keywords (embeddings not supported by AI gateway)
async function searchDocumentChunks(
  supabase: any,
  userId: string,
  keywords: string[]
): Promise<DocumentChunk[]> {
  // Build search query from keywords
  const searchTerms = keywords
    .filter(k => k.length > 2)
    .map(k => k.toLowerCase())
    .join(" | ");
  
  if (!searchTerms) return [];

  // Search using PostgreSQL full-text search with to_tsquery
  const { data: chunks, error } = await supabase
    .from("document_chunks")
    .select(`
      id,
      document_id,
      content,
      metadata,
      documents!inner(filename)
    `)
    .eq("user_id", userId)
    .textSearch("content", searchTerms, { type: "websearch", config: "english" })
    .limit(10);

  if (error) {
    console.error("Text search error:", error);
    
    // Fallback: simple ILIKE search
    const { data: fallbackChunks, error: fallbackError } = await supabase
      .from("document_chunks")
      .select(`
        id,
        document_id,
        content,
        metadata,
        documents!inner(filename)
      `)
      .eq("user_id", userId)
      .or(keywords.map(k => `content.ilike.%${k}%`).join(","))
      .limit(10);
    
    if (fallbackError) {
      console.error("Fallback search error:", fallbackError);
      return [];
    }
    
    return (fallbackChunks || []).map((c: any) => ({
      id: c.id,
      document_id: c.document_id,
      content: c.content,
      metadata: c.metadata,
      similarity: 0.5,
      document_filename: c.documents?.filename || "Unknown",
    }));
  }

  return (chunks || []).map((c: any) => ({
    id: c.id,
    document_id: c.document_id,
    content: c.content,
    metadata: c.metadata,
    similarity: 0.7,
    document_filename: c.documents?.filename || "Unknown",
  }));
}

// Search the web for legal information using Firecrawl
async function searchWebForLegalInfo(query: string, keywords: string[]): Promise<{content: string; sources: string[]}> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  
  if (!FIRECRAWL_API_KEY) {
    console.log("Firecrawl API key not configured");
    return { content: "", sources: [] };
  }

  try {
    // Build a focused search query for Indian legal content
    const searchQuery = `${query} site:indiacode.nic.in OR site:indiankanoon.org OR site:cbic.gov.in`;
    
    console.log("Searching web for:", searchQuery);

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
        scrapeOptions: {
          formats: ["markdown"],
        },
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl search error:", response.status, await response.text());
      return { content: "", sources: [] };
    }

    const data = await response.json();
    const results = data.data || [];
    
    if (results.length === 0) {
      console.log("No web results found");
      return { content: "", sources: [] };
    }

    console.log(`Found ${results.length} web results`);

    // Combine markdown content from results
    const sources: string[] = [];
    let combinedContent = "";

    for (const result of results) {
      if (result.markdown) {
        // Limit each result to first 2000 chars to avoid token limits
        const truncatedContent = result.markdown.slice(0, 2000);
        combinedContent += `\n\n[Source: ${result.url}]\n${truncatedContent}`;
        sources.push(result.url);
      } else if (result.description) {
        combinedContent += `\n\n[Source: ${result.url}]\n${result.title || ""}\n${result.description}`;
        sources.push(result.url);
      }
    }

    return { content: combinedContent, sources };
  } catch (error) {
    console.error("Web search error:", error);
    return { content: "", sources: [] };
  }
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

    // RAG: Search for relevant document chunks using text search
    let contextChunks: DocumentChunk[] = [];
    let contextText = "";
    let webSources: string[] = [];
    
    try {
      // Use classification keywords for text-based search
      const searchKeywords = classification.keywords.length > 0 
        ? classification.keywords 
        : trimmedQuery.split(/\s+/).filter(w => w.length > 2);
      
      contextChunks = await searchDocumentChunks(supabase, userId, searchKeywords);

      if (contextChunks.length > 0) {
        // Build context text from local documents
        contextText = contextChunks
          .map((c, i) => `[Source ${i + 1}: ${c.document_filename}]\n${c.content}`)
          .join("\n\n---\n\n");
      } else {
        // No local documents found - search the web for legal information
        console.log("No local documents found, searching web...");
        const webResults = await searchWebForLegalInfo(trimmedQuery, searchKeywords);
        
        if (webResults.content) {
          contextText = webResults.content;
          webSources = webResults.sources;
          console.log(`Found ${webSources.length} web sources`);
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
      const sourceType = contextChunks.length > 0 ? "VERIFIED DOCUMENTS" : "OFFICIAL GOVERNMENT WEBSITES";
      contextMessage += `CONTEXT FROM ${sourceType}:
${contextText}

---

`;
    } else {
      contextMessage += `CONTEXT: No verified documents or official web sources found for this query.

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

    // Build sources list - include both local documents and web sources
    const sources = contextChunks.length > 0
      ? contextChunks.map(c => ({
          filename: c.document_filename,
          similarity: c.similarity,
          type: "document" as const,
        }))
      : webSources.map(url => ({
          filename: new URL(url).hostname,
          url,
          type: "web" as const,
        }));

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        classification,
        query: trimmedQuery,
        sourcesUsed: contextChunks.length || webSources.length,
        sources,
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
