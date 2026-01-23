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

// Simple text chunking with overlap
function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  // Clean the text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  while (start < cleanedText.length) {
    let end = start + chunkSize;
    
    // Try to break at a sentence or paragraph boundary
    if (end < cleanedText.length) {
      const searchStart = Math.max(end - 100, start);
      const searchText = cleanedText.slice(searchStart, end + 100);
      
      // Look for paragraph break first
      const paragraphBreak = searchText.lastIndexOf('\n\n');
      if (paragraphBreak > 0) {
        end = searchStart + paragraphBreak + 2;
      } else {
        // Look for sentence end
        const sentenceEnd = searchText.lastIndexOf('. ');
        if (sentenceEnd > 0) {
          end = searchStart + sentenceEnd + 2;
        }
      }
    }
    
    const chunk = cleanedText.slice(start, end).trim();
    if (chunk.length > 50) { // Only add chunks with meaningful content
      chunks.push(chunk);
    }
    
    start = end - overlap;
    if (start >= cleanedText.length) break;
  }
  
  return chunks;
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

// Extract text from PDF using pdf-parse approach
async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  // For now, we'll use a simple approach - extract readable text patterns
  // This is a basic extraction that works for text-based PDFs
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let text = "";
  
  try {
    const pdfText = decoder.decode(pdfBytes);
    
    // Extract text between parentheses in PDF text streams (common pattern)
    const textMatches = pdfText.matchAll(/\((.*?)\)/g);
    const textParts: string[] = [];
    
    for (const match of textMatches) {
      const part = match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
      
      if (part.length > 0 && !/^[\x00-\x1F]*$/.test(part)) {
        textParts.push(part);
      }
    }
    
    text = textParts.join(' ');
    
    // Also try to extract from Tj/TJ operators
    const tjMatches = pdfText.matchAll(/\[(.*?)\]\s*TJ/g);
    for (const match of tjMatches) {
      const content = match[1];
      const subMatches = content.matchAll(/\((.*?)\)/g);
      for (const subMatch of subMatches) {
        text += ' ' + subMatch[1];
      }
    }
    
    // Clean up the extracted text
    text = text
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
      
  } catch (e) {
    console.error("PDF extraction error:", e);
    throw new Error("Failed to extract text from PDF");
  }
  
  return text;
}

interface ProcessRequest {
  documentId: string;
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Service unavailable", code: "SERVICE_ERROR" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth to verify ownership
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid session", code: "AUTH_INVALID" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    const body: ProcessRequest = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "Document ID required", code: "DOC_ID_MISSING" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify document ownership
    const { data: document, error: docError } = await userClient
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: "Document not found", code: "DOC_NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for storage and chunk operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Update status to processing
    await serviceClient
      .from("documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    try {
      // Download the PDF
      const { data: fileData, error: downloadError } = await serviceClient.storage
        .from("legal-documents")
        .download(document.file_path);

      if (downloadError || !fileData) {
        throw new Error("Failed to download document");
      }

      // Extract text from PDF
      const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
      const extractedText = await extractTextFromPdf(pdfBytes);

      if (!extractedText || extractedText.length < 100) {
        // If basic extraction fails or returns too little text, mark as failed
        // In production, you'd want to use a proper PDF parsing service
        await serviceClient
          .from("documents")
          .update({ status: "failed" })
          .eq("id", documentId);

        return new Response(
          JSON.stringify({ 
            error: "Could not extract text from PDF. The document may be image-based or encrypted.", 
            code: "EXTRACTION_FAILED" 
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Chunk the text
      const chunks = chunkText(extractedText);
      console.log(`Extracted ${chunks.length} chunks from document`);

      // Generate embeddings and store chunks
      const chunkRecords = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          const embedding = await generateEmbedding(chunk, lovableApiKey);
          
          chunkRecords.push({
            document_id: documentId,
            user_id: userId,
            content: chunk,
            chunk_index: i,
            embedding: JSON.stringify(embedding),
            metadata: {
              filename: document.filename,
              chunk_of: chunks.length,
            },
          });
        } catch (embError) {
          console.error(`Failed to embed chunk ${i}:`, embError);
          // Continue with other chunks
        }
      }

      if (chunkRecords.length === 0) {
        await serviceClient
          .from("documents")
          .update({ status: "failed" })
          .eq("id", documentId);

        return new Response(
          JSON.stringify({ error: "Failed to process document content", code: "PROCESSING_FAILED" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert chunks in batches
      const batchSize = 50;
      for (let i = 0; i < chunkRecords.length; i += batchSize) {
        const batch = chunkRecords.slice(i, i + batchSize);
        const { error: insertError } = await serviceClient
          .from("document_chunks")
          .insert(batch);
        
        if (insertError) {
          console.error("Chunk insert error:", insertError);
          throw new Error("Failed to store document chunks");
        }
      }

      // Update document status to processed
      await serviceClient
        .from("documents")
        .update({ status: "processed" })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          chunksProcessed: chunkRecords.length,
          documentId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (processError) {
      console.error("Processing error:", processError);
      
      await serviceClient
        .from("documents")
        .update({ status: "failed" })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ error: "Document processing failed", code: "PROCESSING_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Process document error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
