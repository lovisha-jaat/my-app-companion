import { useState } from "react";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { Plus, MessageSquare, Trash2, MoreHorizontal, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ChatSession } from "@/hooks/useChatSessions";
import { useAuth } from "@/contexts/AuthContext";

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  isCollapsed?: boolean;
}

interface GroupedSessions {
  today: ChatSession[];
  yesterday: ChatSession[];
  thisWeek: ChatSession[];
  thisMonth: ChatSession[];
  older: ChatSession[];
}

function groupSessionsByDate(sessions: ChatSession[]): GroupedSessions {
  const groups: GroupedSessions = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  };

  sessions.forEach((session) => {
    const date = new Date(session.updated_at);
    if (isToday(date)) {
      groups.today.push(session);
    } else if (isYesterday(date)) {
      groups.yesterday.push(session);
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(session);
    } else if (isThisMonth(date)) {
      groups.thisMonth.push(session);
    } else {
      groups.older.push(session);
    }
  });

  return groups;
}

function SessionGroup({
  title,
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  isCollapsed,
}: {
  title: string;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  isCollapsed?: boolean;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  if (sessions.length === 0) return null;

  const handleDeleteClick = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (sessionToDelete) {
      onDeleteSession(sessionToDelete);
    }
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  return (
    <>
      <div className="mb-2">
        {!isCollapsed && (
          <h3 className="mb-1 px-3 text-xs font-medium text-muted-foreground">
            {title}
          </h3>
        )}
        <div className="space-y-0.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
                currentSessionId === session.id && "bg-muted"
              )}
            >
              <button
                onClick={() => onSelectSession(session.id)}
                className="flex flex-1 items-center gap-2 truncate text-left"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                {!isCollapsed && (
                  <span className="truncate">
                    {session.title || "New conversation"}
                  </span>
                )}
              </button>
              {!isCollapsed && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDeleteClick(session.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  isCollapsed = false,
}: ChatSidebarProps) {
  const { signOut, user } = useAuth();
  const groupedSessions = groupSessionsByDate(sessions);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className={cn(
            "w-full justify-start gap-2",
            isCollapsed && "justify-center px-2"
          )}
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span>New chat</span>}
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1 px-1">
        <div className="p-2">
          <SessionGroup
            title="Today"
            sessions={groupedSessions.today}
            currentSessionId={currentSessionId}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            isCollapsed={isCollapsed}
          />
          <SessionGroup
            title="Yesterday"
            sessions={groupedSessions.yesterday}
            currentSessionId={currentSessionId}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            isCollapsed={isCollapsed}
          />
          <SessionGroup
            title="This week"
            sessions={groupedSessions.thisWeek}
            currentSessionId={currentSessionId}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            isCollapsed={isCollapsed}
          />
          <SessionGroup
            title="This month"
            sessions={groupedSessions.thisMonth}
            currentSessionId={currentSessionId}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            isCollapsed={isCollapsed}
          />
          <SessionGroup
            title="Older"
            sessions={groupedSessions.older}
            currentSessionId={currentSessionId}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            isCollapsed={isCollapsed}
          />
        </div>
      </ScrollArea>

      {/* User Section */}
      {user && (
        <div className="border-t p-3">
          <div className={cn(
            "flex items-center gap-2",
            isCollapsed && "justify-center"
          )}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <>
                <span className="flex-1 truncate text-sm">{user.email}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
