import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useWorkspaceMembers } from "./useCrm";

export const NOTE_COLORS = {
  violet: "border-violet-200/80 bg-violet-50/80 text-violet-950",
  mint: "border-emerald-200/80 bg-emerald-50/80 text-emerald-950",
  amber: "border-amber-200/80 bg-amber-50/80 text-amber-950",
  blue: "border-cyan-200/80 bg-cyan-50/80 text-cyan-950",
  rose: "border-rose-200/80 bg-rose-50/80 text-rose-950",
};

export const NOTE_ACCENTS = {
  violet: "bg-violet-500",
  mint: "bg-emerald-500",
  amber: "bg-amber-500",
  blue: "bg-cyan-500",
  rose: "bg-rose-500",
};

async function result(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

export function useWorkspaceNotes() {
  const { activeWorkspaceId, user } = useAuthWorkspace();
  const members = useWorkspaceMembers();
  const client = useQueryClient();
  const queryKey = useMemo(
    () => ["workspace-notes", activeWorkspaceId, user?.id],
    [activeWorkspaceId, user?.id],
  );
  const query = useQuery({
    queryKey,
    enabled: Boolean(activeWorkspaceId && user),
    queryFn: async () => {
      const [notes, lines] = await Promise.all([
        result(
          supabase
            .from("workspace_notes")
            .select("*")
            .eq("workspace_id", activeWorkspaceId)
            .is("archived_at", null)
            .order("is_pinned", { ascending: false })
            .order("updated_at", { ascending: false }),
        ),
        result(
          supabase
            .from("workspace_note_lines")
            .select("*")
            .eq("workspace_id", activeWorkspaceId)
            .order("line_order")
            .order("created_at"),
        ),
      ]);
      return notes.map((note) => ({
        ...note,
        lines: lines.filter((line) => line.note_id === note.id),
      }));
    },
  });

  useEffect(() => {
    if (!activeWorkspaceId) return undefined;
    const channel = supabase.channel(
      `workspace-notes:${activeWorkspaceId}:${crypto.randomUUID()}`,
    );
    const refresh = () => client.invalidateQueries({ queryKey });
    ["workspace_notes", "workspace_note_lines"].forEach((table) =>
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        refresh,
      ),
    );
    channel.subscribe();
    return () => {
      channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, client, queryKey]);

  const refresh = () => client.invalidateQueries({ queryKey });
  const createNote = async (input = {}) => {
    const note = await result(
      supabase
        .from("workspace_notes")
        .insert({
          workspace_id: activeWorkspaceId,
          owner_id: user.id,
          updated_by: user.id,
          visibility: input.visibility === "shared" ? "shared" : "private",
          title: input.title?.trim() || "Untitled note",
          body: input.body?.trim() || "",
          color: input.color || "violet",
          is_pinned: Boolean(input.is_pinned),
        })
        .select()
        .single(),
    );
    const lines = (input.lines ?? []).map((body, index) => ({
      note_id: note.id,
      workspace_id: activeWorkspaceId,
      created_by: user.id,
      body: body.trim(),
      line_order: index,
    })).filter((line) => line.body);
    if (lines.length) await result(supabase.from("workspace_note_lines").insert(lines));
    await refresh();
    return note;
  };

  const updateNote = async (noteId, changes) => {
    const allowed = ["title", "body", "visibility", "color", "is_pinned", "archived_at"];
    const payload = Object.fromEntries(
      Object.entries(changes)
        .filter(([key]) => allowed.includes(key))
        .map(([key, value]) => [key, typeof value === "string" && ["title", "body"].includes(key) ? value.trim() : value]),
    );
    payload.updated_by = user.id;
    if (Object.keys(payload).length > 1)
      await result(
        supabase
          .from("workspace_notes")
          .update(payload)
          .eq("id", noteId)
          .eq("workspace_id", activeWorkspaceId),
      );
    await refresh();
  };

  const deleteNote = async (noteId) => {
    await result(
      supabase
        .from("workspace_notes")
        .delete()
        .eq("id", noteId)
        .eq("workspace_id", activeWorkspaceId),
    );
    await refresh();
  };

  const createLine = async (noteId, body) => {
    const note = query.data?.find((item) => item.id === noteId);
    if (!body?.trim()) return null;
    const line = await result(
      supabase
        .from("workspace_note_lines")
        .insert({
          note_id: noteId,
          workspace_id: activeWorkspaceId,
          created_by: user.id,
          body: body.trim(),
          line_order: note?.lines?.length ?? 0,
        })
        .select()
        .single(),
    );
    await refresh();
    return line;
  };

  const updateLine = async (lineId, changes) => {
    const payload = Object.fromEntries(
      Object.entries(changes).filter(([key]) => ["body", "is_done", "line_order"].includes(key)),
    );
    if (typeof payload.body === "string") payload.body = payload.body.trim();
    await result(
      supabase
        .from("workspace_note_lines")
        .update(payload)
        .eq("id", lineId)
        .eq("workspace_id", activeWorkspaceId),
    );
    await refresh();
  };

  const deleteLine = async (lineId) => {
    await result(
      supabase
        .from("workspace_note_lines")
        .delete()
        .eq("id", lineId)
        .eq("workspace_id", activeWorkspaceId),
    );
    await refresh();
  };

  return {
    ...query,
    notes: query.data ?? [],
    members: members.data ?? [],
    createNote,
    updateNote,
    deleteNote,
    createLine,
    updateLine,
    deleteLine,
    refresh,
  };
}

export function useNoteComments(noteId) {
  const { activeWorkspaceId, user } = useAuthWorkspace();
  const members = useWorkspaceMembers();
  const client = useQueryClient();
  const queryKey = ["workspace-note-comments", activeWorkspaceId, noteId];
  const query = useQuery({
    queryKey,
    enabled: Boolean(activeWorkspaceId && noteId),
    queryFn: () =>
      result(
        supabase
          .from("workspace_note_comments")
          .select("*")
          .eq("note_id", noteId)
          .eq("workspace_id", activeWorkspaceId)
          .order("created_at"),
      ),
  });
  useEffect(() => {
    if (!activeWorkspaceId || !noteId) return undefined;
    const channel = supabase
      .channel(`workspace-note-comments:${noteId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_note_comments",
          filter: `note_id=eq.${noteId}`,
        },
        () =>
          client.invalidateQueries({
            queryKey: ["workspace-note-comments", activeWorkspaceId, noteId],
          }),
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, client, noteId]);

  const addComment = async (body) => {
    const lowered = body.toLowerCase();
    const mentioned = (members.data ?? [])
      .filter(
        (member) =>
          lowered.includes(`@${(member.full_name || member.email).toLowerCase()}`) ||
          lowered.includes(`@${member.email.split("@")[0].toLowerCase()}`),
      )
      .map((member) => member.id);
    await result(
      supabase.from("workspace_note_comments").insert({
        note_id: noteId,
        workspace_id: activeWorkspaceId,
        author_id: user.id,
        body: body.trim(),
        mentioned_user_ids: mentioned,
      }),
    );
    await client.invalidateQueries({ queryKey });
  };

  return { ...query, comments: query.data ?? [], members: members.data ?? [], addComment };
}
