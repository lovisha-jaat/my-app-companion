import { cn } from "@/lib/utils";
import { Scale, User, ShieldCheck } from "lucide-react";
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
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

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
            : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
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
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-chat-user text-chat-user-foreground rounded-br-md"
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
