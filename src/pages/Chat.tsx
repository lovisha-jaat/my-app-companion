import { useState, useCallback } from "react";
import { ChatContainer, Message } from "@/components/chat";
import { Scale, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classifyQuery } from "@/lib/classify-query";
import { useToast } from "@/hooks/use-toast";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
      // Step 2: Classify the query
      const classification = await classifyQuery(content);

      // Update the user message with classification
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, classification } : msg
        )
      );

      // Placeholder response - will be replaced with RAG in later steps
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I've classified your query as:

**Domain:** ${classification.domain.toUpperCase()}
**Type:** ${classification.queryType}
**Confidence:** ${classification.confidence}
**Keywords:** ${classification.keywords.join(", ")}

The full AI response with verified legal information will be implemented in the next step.`,
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
  }, [toast]);

  const handleFileUpload = () => {
    // Will be implemented for document upload feature
    toast({
      title: "Coming Soon",
      description: "Document upload will be available in a future update.",
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
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            AI-Powered Legal Reference
          </span>
        </div>
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
    </div>
  );
}
