import { cn } from "@/lib/utils";
import { Scale, User, ShieldCheck, Globe, BookOpen, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  QueryClassification,
  DOMAIN_LABELS,
  QUERY_TYPE_LABELS,
  DOMAIN_COLORS,
} from "@/lib/classify-query";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  classification?: QueryClassification;
  sourceType?: "document" | "web" | "general";
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isGeneralKnowledge = !isUser && message.sourceType === "general";

  const getSourceBadge = () => {
    if (isUser || !message.sourceType) return null;
    
    switch (message.sourceType) {
      case "document":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            <BookOpen className="h-3 w-3" />
            From Documents
          </span>
        );
      case "web":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <Globe className="h-3 w-3" />
            Official Sources
          </span>
        );
      case "general":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Brain className="h-3 w-3" />
            General Knowledge
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "flex gap-3 p-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : isGeneralKnowledge
            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : isGeneralKnowledge ? (
          <Brain className="h-4 w-4" />
        ) : (
          <Scale className="h-4 w-4" />
        )}
      </div>
      <div className={cn("max-w-[80%]", isUser ? "text-right" : "text-left")}>
        {/* Classification badges for user messages */}
        {isUser && message.classification && (
          <div className="mb-2 flex flex-wrap justify-end gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                DOMAIN_COLORS[message.classification.domain]
              )}
            >
              {DOMAIN_LABELS[message.classification.domain]}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {QUERY_TYPE_LABELS[message.classification.queryType]}
            </span>
            {message.classification.confidence === "high" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                <ShieldCheck className="h-3 w-3" />
                High Confidence
              </span>
            )}
          </div>
        )}
        {/* Source badge for assistant messages */}
        {!isUser && message.sourceType && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {getSourceBadge()}
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-chat-user text-chat-user-foreground rounded-br-md"
              : isGeneralKnowledge
              ? "bg-amber-50 dark:bg-amber-950/20 text-chat-bot-foreground rounded-bl-md border border-amber-200 dark:border-amber-800/50"
              : "bg-chat-bot text-chat-bot-foreground rounded-bl-md"
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0 [&>h1]:text-base [&>h1]:font-semibold [&>h1]:mb-2 [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mb-1.5 [&>h3]:text-sm [&>h3]:font-medium [&>h3]:mb-1 [&>ul]:mb-2 [&>ul]:pl-4 [&>ol]:mb-2 [&>ol]:pl-4 [&>li]:mb-0.5 [&>blockquote]:border-l-2 [&>blockquote]:border-primary/30 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-muted-foreground">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
          <span
            className={cn(
              "mt-1 block text-xs",
              isUser ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        {/* Keywords for user messages */}
        {isUser && message.classification?.keywords && message.classification.keywords.length > 0 && (
          <div className="mt-1.5 flex flex-wrap justify-end gap-1">
            {message.classification.keywords.slice(0, 4).map((keyword, i) => (
              <span
                key={i}
                className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
