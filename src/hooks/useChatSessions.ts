import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

export interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export function useChatSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch all sessions for the user
  const fetchSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create a new session
  const createSession = useCallback(async (title?: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: title || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      setSessions((prev) => [data, ...prev]);
      setCurrentSessionId(data.id);
      return data;
    } catch (error) {
      console.error("Error creating session:", error);
      return null;
    }
  }, [user]);

  // Update session title
  const updateSessionTitle = useCallback(async (sessionId: string, title: string) => {
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      if (error) throw error;
      
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
      );
    } catch (error) {
      console.error("Error updating session title:", error);
    }
  }, []);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;
      
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  }, [currentSessionId]);

  // Load messages for a session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error loading session messages:", error);
      return [];
    }
  }, [user]);

  // Save a message to the current session
  const saveMessage = useCallback(async (
    sessionId: string,
    role: string,
    content: string,
    classification?: Json
  ) => {
    if (!user) return null;

    try {
      const insertData: {
        session_id: string;
        user_id: string;
        role: string;
        content: string;
        classification?: Json;
      } = {
        session_id: sessionId,
        user_id: user.id,
        role,
        content,
      };
      
      if (classification !== undefined) {
        insertData.classification = classification;
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Update session's updated_at
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      return data;
    } catch (error) {
      console.error("Error saving message:", error);
      return null;
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    loading,
    fetchSessions,
    createSession,
    updateSessionTitle,
    deleteSession,
    loadSessionMessages,
    saveMessage,
  };
}
