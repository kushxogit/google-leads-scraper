import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useWorkspaceMembers } from "./useCrm";

async function result(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

const attachmentUrl = async (attachment) => {
  const { data, error } = await supabase.storage
    .from("project-chat-files")
    .createSignedUrl(attachment.path, 60 * 60);
  return error ? { ...attachment } : { ...attachment, url: data.signedUrl };
};

export function useProjectChat(projectId) {
  const { activeWorkspaceId, user } = useAuthWorkspace();
  const members = useWorkspaceMembers();
  const client = useQueryClient();
  const queryKey = useMemo(() => ["project-chat", activeWorkspaceId, projectId], [activeWorkspaceId, projectId]);
  const query = useQuery({
    queryKey,
    enabled: Boolean(activeWorkspaceId && projectId),
    queryFn: async () => {
      const [messages, saves] = await Promise.all([
        result(supabase.from("project_chat_messages").select("*").eq("workspace_id", activeWorkspaceId).eq("project_id", projectId).order("created_at")),
        result(supabase.from("project_chat_saves").select("*").eq("workspace_id", activeWorkspaceId).eq("project_id", projectId).order("created_at", { ascending: false })),
      ]);
      return Promise.all(messages.map(async (message) => ({
        ...message,
        attachments: await Promise.all((message.attachments ?? []).map(attachmentUrl)),
        saved_by_me: saves.some((save) => save.message_id === message.id && save.saved_by === user?.id),
        saved_count: saves.filter((save) => save.message_id === message.id).length,
      })));
    },
  });
  useEffect(() => {
    if (!activeWorkspaceId || !projectId) return undefined;
    const channel = supabase.channel(`project-chat:${projectId}:${crypto.randomUUID()}`);
    const refresh = () => client.invalidateQueries({ queryKey });
    ["project_chat_messages", "project_chat_saves"].forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `workspace_id=eq.${activeWorkspaceId}` }, refresh));
    channel.subscribe();
    return () => { channel.unsubscribe(); void supabase.removeChannel(channel); };
  }, [activeWorkspaceId, client, projectId, queryKey]);

  const refresh = () => client.invalidateQueries({ queryKey });
  const sendMessage = async ({ body, files = [] }) => {
    const attachments = [];
    for (const file of files) {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${activeWorkspaceId}/${projectId}/${crypto.randomUUID()}-${cleanName}`;
      await result(supabase.storage.from("project-chat-files").upload(path, file, { contentType: file.type || "application/octet-stream" }));
      attachments.push({ path, name: file.name, type: file.type, size: file.size });
    }
    await result(supabase.from("project_chat_messages").insert({ workspace_id: activeWorkspaceId, project_id: projectId, author_id: user.id, body: body.trim(), attachments }));
    await refresh();
  };
  const toggleSave = async (message) => {
    if (message.saved_by_me) {
      await result(supabase.from("project_chat_saves").delete().eq("message_id", message.id).eq("saved_by", user.id));
    } else {
      await result(supabase.from("project_chat_saves").insert({ message_id: message.id, workspace_id: activeWorkspaceId, project_id: projectId, saved_by: user.id }));
    }
    await refresh();
  };
  return { ...query, messages: query.data ?? [], members: members.data ?? [], sendMessage, toggleSave };
}
