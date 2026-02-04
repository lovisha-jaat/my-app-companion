import { useState, useCallback, useMemo, useEffect } from "react";
import { ChatContainer, Message } from "@/components/chat";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { DocumentUploadDialog } from "@/components/chat/DocumentUploadDialog";
import { Scale, Menu, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classifyQuery } from "@/lib/classify-query";
import { generateResponse } from "@/lib/generate-response";
import { useToast } from "@/hooks/use-toast";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    createSession,
    deleteSession,
    loadSessionMessages,
    saveMessage,
    updateSessionTitle,
  } = useChatSessions();

  // Load messages when session changes
  useEffect(() => {
    const loadMessages = async () => {
      if (currentSessionId) {
        const dbMessages = await loadSessionMessages(currentSessionId);
        const formattedMessages: Message[] = dbMessages.map((msg) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.created_at),
          classification: msg.classification as unknown as Message["classification"],
        }));
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    };
    loadMessages();
  }, [currentSessionId, loadSessionMessages]);

  // Build conversation history for context
  const conversationHistory = useMemo(() => {
    return messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));
  }, [messages]);

  const handleSendMessage = useCallback(async (content: string) => {
    // Create a session if none exists
    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession = await createSession();
      if (!newSession) {
        toast({
          title: "Error",
          description: "Failed to create a new chat session",
          variant: "destructive",
        });
        return;
      }
      sessionId = newSession.id;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Save user message to DB
    await saveMessage(sessionId, "user", content);

    // Update session title if this is the first message
    if (messages.length === 0) {
      const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
      await updateSessionTitle(sessionId, title);
    }

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

      // Save assistant message to DB
      await saveMessage(sessionId, "assistant", result.response);
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
      await saveMessage(sessionId, "assistant", errorMessage.content);
    } finally {
      setIsLoading(false);
    }
  }, [toast, conversationHistory, currentSessionId, createSession, saveMessage, updateSessionTitle, messages.length]);

  const handleFileUpload = () => {
    setUploadDialogOpen(true);
  };

  const handleUploadComplete = () => {
    toast({
      title: "Knowledge Base Updated",
      description: "Your document has been added. You can now ask questions about it.",
    });
  };

  const handleNewChat = useCallback(async () => {
    setCurrentSessionId(null);
    setMessages([]);
    setMobileSidebarOpen(false);
  }, [setCurrentSessionId]);

  const handleSelectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMobileSidebarOpen(false);
  }, [setCurrentSessionId]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteSession(sessionId);
    if (currentSessionId === sessionId) {
      setMessages([]);
    }
  }, [deleteSession, currentSessionId]);

  const sidebarContent = (
    <ChatSidebar
      sessions={sessions}
      currentSessionId={currentSessionId}
      onSelectSession={handleSelectSession}
      onNewChat={handleNewChat}
      onDeleteSession={handleDeleteSession}
      isCollapsed={sidebarCollapsed && !isMobile}
    />
  );

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className={cn(
            "hidden border-r transition-all duration-300 md:flex md:flex-col",
            sidebarCollapsed ? "w-16" : "w-64"
          )}
        >
          {sidebarContent}
        </aside>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-3">
            {/* Mobile Menu */}
            {isMobile && (
              <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  {sidebarContent}
                </SheetContent>
              </Sheet>
            )}

            {/* Desktop Collapse Toggle */}
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>
            )}

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
      </div>

      {/* Document Upload Dialog */}
      <DocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
