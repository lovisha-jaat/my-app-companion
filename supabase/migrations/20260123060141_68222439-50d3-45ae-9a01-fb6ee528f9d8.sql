-- Create storage bucket for legal documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'legal-documents', 
  'legal-documents', 
  false, 
  52428800, -- 50MB limit
  ARRAY['application/pdf']::text[]
);

-- Storage policies for legal documents
CREATE POLICY "Users can upload their own legal documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'legal-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own legal documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'legal-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own legal documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'legal-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document chunks table for RAG
CREATE TABLE public.document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on document_chunks
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Document chunks policies
CREATE POLICY "Users can view their own document chunks"
  ON public.document_chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own document chunks"
  ON public.document_chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own document chunks"
  ON public.document_chunks FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster vector similarity search
CREATE INDEX document_chunks_embedding_idx ON public.document_chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create index for document_id lookups
CREATE INDEX document_chunks_document_id_idx ON public.document_chunks(document_id);

-- Create function for semantic search
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE dc.user_id = p_user_id
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;