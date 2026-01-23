export type LegalDomain = "finance" | "gst" | "civil" | "criminal" | "other";
export type QueryType = "informational" | "decision" | "document";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface QueryClassification {
  domain: LegalDomain;
  queryType: QueryType;
  confidence: ConfidenceLevel;
  keywords: string[];
}

export interface ClassifyQueryResponse {
  classification: QueryClassification;
  query: string;
}

import { supabase } from "@/integrations/supabase/client";

export async function classifyQuery(query: string): Promise<QueryClassification> {
  // Get the current session token for authenticated requests
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`https://sdbmnevfqxmwhbwbdxmo.supabase.co/functions/v1/classify-query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Classification failed" }));
    throw new Error(error.error || "Failed to classify query");
  }

  const data: ClassifyQueryResponse = await response.json();
  return data.classification;
}

export const DOMAIN_LABELS: Record<LegalDomain, string> = {
  finance: "Finance & Tax",
  gst: "GST",
  civil: "Civil Law",
  criminal: "Criminal Law",
  other: "General",
};

export const QUERY_TYPE_LABELS: Record<QueryType, string> = {
  informational: "Information",
  decision: "Decision",
  document: "Document",
};

export const DOMAIN_COLORS: Record<LegalDomain, string> = {
  finance: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  gst: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  civil: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  criminal: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};
