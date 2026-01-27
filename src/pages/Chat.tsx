import { useState, useCallback, useMemo } from "react";
import { ChatContainer, Message } from "@/components/chat";
import { DocumentUploadDialog } from "@/components/chat/DocumentUploadDialog";
import { Scale, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classifyQuery } from "@/lib/classify-query";
import { generateResponse } from "@/lib/generate-response";
import { useToast } from "@/hooks/use-toast";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { toast } = useToast();

  // Build conversation history for context
  const conversationHistory = useMemo(() => {
    return messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));
  }, [messages]);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Step 1: Classify the query
      const classification = await classifyQuery(content);

      // Update the user message with classification
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, classification } : msg
        )
      );

      // Step 2: Generate AI response using ruleX persona with RAG
      const result = await generateResponse({
        query: content,
        classification,
        conversationHistory,
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error processing message:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process your query",
        variant: "destructive",
      });

      // Still add a fallback response
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I apologize, but I encountered an error processing your query. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, conversationHistory]);

  const handleFileUpload = () => {
    setUploadDialogOpen(true);
  };

  const handleUploadComplete = () => {
    toast({
      title: "Knowledge Base Updated",
      description: "Your document has been added. You can now ask questions about it.",
    });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Scale className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">ruleX</span>
          </div>
        </div>
        <span className="hidden text-sm text-muted-foreground lg:inline">
          AI-Powered Legal Reference
        </span>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden">
        <ChatContainer
          messages={messages}
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
        />
      </main>

      {/* Document Upload Dialog */}
      <DocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
