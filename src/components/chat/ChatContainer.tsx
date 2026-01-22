import { useRef, useEffect } from "react";
import { ChatMessage, Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scale } from "lucide-react";

interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onFileUpload?: () => void;
  isLoading?: boolean;
}

export function ChatContainer({
  messages,
  onSendMessage,
  onFileUpload,
  isLoading = false,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleExampleClick = (query: string) => {
    onSendMessage(query);
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="min-h-full">
          {messages.length === 0 ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Scale className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-foreground">
                Welcome to ruleX
              </h2>
              <p className="mb-8 max-w-md text-center text-muted-foreground">
                Your AI-powered legal companion for Indian finance and government laws.
                Ask any question in natural language.
              </p>
              <div className="grid w-full max-w-lg gap-3">
                <ExampleQuery
                  query="What is Section 16 of the CGST Act?"
                  onClick={handleExampleClick}
                />
                <ExampleQuery
                  query="Explain the Income Tax Act provisions for salaried employees"
                  onClick={handleExampleClick}
                />
                <ExampleQuery
                  query="What are the penalties under FEMA for unauthorized transactions?"
                  onClick={handleExampleClick}
                />
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex gap-3 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Scale className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-chat-bot px-4 py-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
      <ChatInput
        onSend={onSendMessage}
        onFileUpload={onFileUpload}
        disabled={isLoading}
      />
    </div>
  );
}

function ExampleQuery({
  query,
  onClick,
}: {
  query: string;
  onClick: (query: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(query)}
      className="rounded-xl border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      "{query}"
    </button>
  );
}
