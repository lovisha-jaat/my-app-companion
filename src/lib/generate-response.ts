import { supabase } from "@/integrations/supabase/client";
import type { QueryClassification } from "./classify-query";

export interface GenerateResponseParams {
  query: string;
  classification: QueryClassification;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface GenerateResponseResult {
  response: string;
  classification: QueryClassification;
  query: string;
  sourceType?: "document" | "web" | "general";
  sourcesUsed?: number;
  sources?: Array<{ filename?: string; url?: string; type: "document" | "web" }>;
}

export async function generateResponse({
  query,
  classification,
  conversationHistory = [],
}: GenerateResponseParams): Promise<GenerateResponseResult> {
  // Get the current session token for authenticated requests
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(
    `https://sdbmnevfqxmwhbwbdxmo.supabase.co/functions/v1/generate-response`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ 
        query, 
        classification,
        conversationHistory,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Response generation failed" }));
    throw new Error(error.error || "Failed to generate response");
  }

  const data: GenerateResponseResult = await response.json();
  return data;
}
