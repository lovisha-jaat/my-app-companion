import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
}

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

export function DocumentUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
}: DocumentUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const resetState = useCallback(() => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setErrorMessage(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      setFile(droppedFile);
      setErrorMessage(null);
    } else {
      setErrorMessage("Please upload a PDF file");
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.type === "application/pdf") {
      setFile(selectedFile);
      setErrorMessage(null);
    } else if (selectedFile) {
      setErrorMessage("Please upload a PDF file");
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setProgress(10);
    setErrorMessage(null);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Authentication required");
      }

      // Upload to storage
      const filePath = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      setProgress(20);

      const { error: uploadError } = await supabase.storage
        .from("legal-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Failed to upload file");
      }

      setProgress(40);

      // Create document record
      const { data: docRecord, error: dbError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          filename: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          status: "pending",
        })
        .select()
        .single();

      if (dbError || !docRecord) {
        console.error("DB error:", dbError);
        throw new Error("Failed to create document record");
      }

      setProgress(60);
      setStatus("processing");

      // Trigger processing
      const { data: { session } } = await supabase.auth.getSession();
      
      const processResponse = await fetch(
        `https://sdbmnevfqxmwhbwbdxmo.supabase.co/functions/v1/process-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ documentId: docRecord.id }),
        }
      );

      setProgress(80);

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Document processing failed");
      }

      setProgress(100);
      setStatus("success");

      toast({
        title: "Document Uploaded",
        description: `${file.name} has been processed and added to your knowledge base.`,
      });

      onUploadComplete?.();
      
      // Close after delay
      setTimeout(() => {
        onOpenChange(false);
        resetState();
      }, 2000);

    } catch (error) {
      console.error("Upload failed:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && status !== "uploading" && status !== "processing") {
      resetState();
    }
    if (status !== "uploading" && status !== "processing") {
      onOpenChange(isOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Legal Document</DialogTitle>
          <DialogDescription>
            Upload official government PDF documents to enable verified responses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {status === "idle" && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors",
                  file
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                {file ? (
                  <>
                    <FileText className="h-10 w-10 text-primary" />
                    <div className="text-center">
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                      Change file
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium text-foreground">Drop PDF here</p>
                      <p className="text-sm text-muted-foreground">or click to browse</p>
                    </div>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileSelect}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </>
                )}
              </div>

              {errorMessage && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errorMessage}
                </p>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file}
                className="w-full"
              >
                Upload and Process
              </Button>
            </>
          )}

          {(status === "uploading" || status === "processing") && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="font-medium">
                  {status === "uploading" ? "Uploading..." : "Processing document..."}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">
                {status === "processing"
                  ? "Extracting text and generating embeddings..."
                  : "Please wait while we upload your document"}
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="h-12 w-12 text-accent" />
              <p className="font-medium text-foreground">Document processed successfully!</p>
              <p className="text-sm text-muted-foreground">
                You can now ask questions about this document.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="font-medium text-foreground">Upload failed</p>
              <p className="text-center text-sm text-destructive">{errorMessage}</p>
              <Button variant="outline" onClick={resetState}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
