import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - restrict to known domains
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

interface ClassificationResult {
  domain: "finance" | "gst" | "civil" | "criminal" | "other";
  queryType: "informational" | "decision" | "document";
  confidence: "high" | "medium" | "low";
  keywords: string[];
}

// Input validation constants
const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 1000;

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session", code: "AUTH_INVALID" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query } = await req.json();

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable", code: "SERVICE_ERROR" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a legal query classifier for Indian laws. Your job is to analyze user queries and classify them accurately.

Legal Domains:
- finance: Income Tax, Banking regulations, Securities, Investment laws, Corporate finance
- gst: Goods and Services Tax, CGST, SGST, IGST, Input Tax Credit, GST returns
- civil: Contract law, Property law, Family law, Succession, Torts, Consumer protection
- criminal: Indian Penal Code, Criminal Procedure, PMLA, Cyber crimes, Financial crimes
- other: Constitutional law, Administrative law, or queries that don't fit above

Query Types:
- informational: Asking for explanation, definition, or details about a law/section
- decision: YES/NO questions, eligibility checks, compliance questions
- document: Queries referencing specific uploaded documents or asking about document-based analysis

Confidence Levels:
- high: Query clearly falls into a specific domain with clear intent
- medium: Query is somewhat ambiguous but likely falls into a category
- low: Query is vague or spans multiple domains

Extract relevant legal keywords from the query.`,
          },
          {
            role: "user",
            content: trimmedQuery,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_query",
              description: "Classify the legal query into domain, type, and confidence level",
              parameters: {
                type: "object",
                properties: {
                  domain: {
                    type: "string",
                    enum: ["finance", "gst", "civil", "criminal", "other"],
                    description: "The legal domain of the query",
                  },
                  queryType: {
                    type: "string",
                    enum: ["informational", "decision", "document"],
                    description: "The type of query",
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Confidence level in the classification",
                  },
                  keywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "Relevant legal keywords extracted from the query",
                  },
                },
                required: ["domain", "queryType", "confidence", "keywords"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_query" } },
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
      // Log detailed error server-side only
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      // Return generic error to client
      return new Response(
        JSON.stringify({ error: "Unable to process your query. Please try again.", code: "PROCESSING_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== "classify_query") {
      console.error("Invalid AI response structure:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Unable to classify your query. Please try again.", code: "CLASSIFICATION_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const classification: ClassificationResult = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ classification, query: trimmedQuery }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Log detailed error server-side only
    console.error("Classification error:", error);
    
    // Return safe, generic message to client
    return new Response(
      JSON.stringify({ 
        error: "Unable to process your query. Please try again.", 
        code: "INTERNAL_ERROR" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
