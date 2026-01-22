import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClassificationResult {
  domain: "finance" | "gst" | "civil" | "criminal" | "other";
  queryType: "informational" | "decision" | "document";
  confidence: "high" | "medium" | "low";
  keywords: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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
            content: query,
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
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "API credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to classify query");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== "classify_query") {
      throw new Error("Invalid response from AI");
    }

    const classification: ClassificationResult = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ classification, query }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Classification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Classification failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
