import { supabase } from "@/integrations/supabase/client";

export interface ScrapeLegalSiteParams {
  url: string;
  scrapeType?: "page" | "crawl";
}

export interface ScrapeLegalSiteResult {
  success: boolean;
  error?: string;
  data?: {
    document_id: string;
    title: string;
    chunks_created: number;
    source_url: string;
  };
}

export interface IndianKanoonSearchParams {
  query: string;
  pagenum?: number;
  ingestToKnowledgeBase?: boolean;
}

export interface IndianKanoonResult {
  id: string;
  title: string;
  headline?: string;
  source?: string;
  date?: string;
  citation?: string;
  url: string;
}

export interface IndianKanoonSearchResult {
  success: boolean;
  error?: string;
  data?: {
    results: IndianKanoonResult[];
    ingested?: string[];
    total_results: number;
    message?: string;
    alternative?: string;
  };
}

// Known official legal sites that can be scraped
export const ALLOWED_LEGAL_SITES = [
  { domain: "indiacode.nic.in", name: "India Code", description: "Official repository of Central and State Acts" },
  { domain: "cbic.gov.in", name: "CBIC", description: "Central Board of Indirect Taxes and Customs" },
  { domain: "gst.gov.in", name: "GST Portal", description: "Goods and Services Tax official portal" },
  { domain: "incometaxindia.gov.in", name: "Income Tax India", description: "Official Income Tax Department" },
  { domain: "mca.gov.in", name: "MCA", description: "Ministry of Corporate Affairs" },
  { domain: "legislative.gov.in", name: "Legislative Dept", description: "Department of Legislative Affairs" },
  { domain: "doj.gov.in", name: "Dept of Justice", description: "Department of Justice" },
  { domain: "egazette.nic.in", name: "e-Gazette", description: "Official Gazette of India" },
  { domain: "lawmin.gov.in", name: "Law Ministry", description: "Ministry of Law and Justice" },
];

export async function scrapeLegalSite(
  params: ScrapeLegalSiteParams
): Promise<ScrapeLegalSiteResult> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(
    `https://sdbmnevfqxmwhbwbdxmo.supabase.co/functions/v1/scrape-legal-site`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params),
    }
  );

  const data = await response.json();
  
  if (!response.ok) {
    return {
      success: false,
      error: data.error || "Failed to scrape legal site",
    };
  }

  return data;
}

export async function searchIndianKanoon(
  params: IndianKanoonSearchParams
): Promise<IndianKanoonSearchResult> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(
    `https://sdbmnevfqxmwhbwbdxmo.supabase.co/functions/v1/indian-kanoon-search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params),
    }
  );

  const data = await response.json();
  
  if (!response.ok) {
    return {
      success: false,
      error: data.error || "Failed to search Indian Kanoon",
    };
  }

  return data;
}
