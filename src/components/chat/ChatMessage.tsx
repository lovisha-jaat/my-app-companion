import { cn } from "@/lib/utils";
import { Scale, User, ShieldCheck, Globe, BookOpen, Brain } from "lucide-react";
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
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
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
