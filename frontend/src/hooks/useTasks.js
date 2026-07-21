import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useWorkspaceMembers } from "./useCrm";

export const TASK_CATEGORIES = {
  meeting: {
    label: "Meeting",
    dot: "bg-rose-500",
    card: "border-rose-200 bg-rose-50 text-rose-950",
  },
  document: {
    label: "Document prep",
    dot: "bg-blue-500",
    card: "border-blue-200 bg-blue-50 text-blue-950",
  },
  proposal: {
    label: "Proposal / outreach",
    dot: "bg-emerald-500",
    card: "border-emerald-200 bg-emerald-50 text-emerald-950",
  },
  follow_up: {
    label: "Sales follow-up",
    dot: "bg-amber-500",
    card: "border-amber-200 bg-amber-50 text-amber-950",
  },
  development: {
    label: "Development / delivery",
    dot: "bg-violet-500",
    card: "border-violet-200 bg-violet-50 text-violet-950",
  },
  admin: {
    label: "Admin / operations",
    dot: "bg-slate-500",
    card: "border-slate-200 bg-slate-50 text-slate-950",
  },
};
export const TASK_STATUSES = [
  "unplanned",
  "planned",
  "in_progress",
  "waiting",
  "done",
  "cancelled",
];

async function result(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

export function useWorkspaceTasks() {
  const { activeWorkspaceId, user } = useAuthWorkspace();
  const members = useWorkspaceMembers();
  const client = useQueryClient();
  const queryKey = ["tasks", activeWorkspaceId];
  const query = useQuery({
    queryKey,
    enabled: Boolean(activeWorkspaceId),
    queryFn: async () => {
      const [tasks, assignees] = await Promise.all([
        result(
          supabase
            .from("tasks")
            .select("*, leads(id,name)")
            .eq("workspace_id", activeWorkspaceId)
            .order("created_at", { ascending: false }),
        ),
        result(
          supabase
            .from("task_assignees")
            .select("*")
            .eq("workspace_id", activeWorkspaceId),
        ),
      ]);
      return tasks.map((task) => ({
        ...task,
        assignee_ids: assignees
          .filter((row) => row.task_id === task.id)
          .map((row) => row.user_id),
      }));
    },
  });
  useEffect(() => {
    if (!activeWorkspaceId) return undefined;
    const channel = supabase.channel(
      `rewind:${activeWorkspaceId}:${crypto.randomUUID()}`,
    );
    const refresh = () =>
      client.invalidateQueries({ queryKey: ["tasks", activeWorkspaceId] });
    ["tasks", "task_assignees"].forEach((table) =>
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
  }, [activeWorkspaceId, client]);

  const refresh = () => client.invalidateQueries({ queryKey });
  const replaceAssignees = async (taskId, assigneeIds) => {
    await result(
      supabase
        .from("task_assignees")
        .delete()
        .eq("task_id", taskId)
        .eq("workspace_id", activeWorkspaceId),
    );
    const unique = [...new Set(assigneeIds)].slice(0, 2);
    if (unique.length)
      await result(
        supabase.from("task_assignees").insert(
          unique.map((userId) => ({
            task_id: taskId,
            workspace_id: activeWorkspaceId,
            user_id: userId,
          })),
        ),
      );
  };
  const createTask = async (input) => {
    const payload = {
      workspace_id: activeWorkspaceId,
      created_by: user.id,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      category: input.category,
      priority: input.priority,
      status: input.scheduled_start ? "planned" : "unplanned",
      lead_id: input.lead_id || null,
      due_at: input.due_at || null,
      scheduled_start: input.scheduled_start || null,
      scheduled_end: input.scheduled_end || null,
      calendar_sync_enabled: Boolean(input.calendar_sync_enabled),
      source_note_id: input.source_note_id || null,
      source_note_line_id: input.source_note_line_id || null,
    };
    const task = await result(
      supabase.from("tasks").insert(payload).select().single(),
    );
    await replaceAssignees(
      task.id,
      input.assignee_ids?.length ? input.assignee_ids : [user.id],
    );
    await refresh();
    return task;
  };
  const updateTask = async (taskId, changes) => {
    const { assignee_ids: assigneeIds, ...payload } = changes;
    if (
      Object.prototype.hasOwnProperty.call(payload, "scheduled_start") &&
      !payload.scheduled_start &&
      query.data?.find((task) => task.id === taskId)?.status === "planned"
    )
      payload.status = "unplanned";
    const allowed = [
      "title",
      "description",
      "category",
      "priority",
      "status",
      "lead_id",
      "due_at",
      "scheduled_start",
      "scheduled_end",
      "calendar_sync_enabled",
    ];
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([key]) => allowed.includes(key)),
    );
    if (Object.keys(cleanPayload).length)
      await result(
        supabase
          .from("tasks")
          .update(cleanPayload)
          .eq("id", taskId)
          .eq("workspace_id", activeWorkspaceId),
      );
    const existing =
      query.data?.find((task) => task.id === taskId)?.assignee_ids ?? [];
    if (
      assigneeIds &&
      [...assigneeIds].sort().join() !== [...existing].sort().join()
    )
      await replaceAssignees(taskId, assigneeIds);
    await refresh();
  };
  const deleteTask = async (taskId) => {
    await result(
      supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("workspace_id", activeWorkspaceId),
    );
    await refresh();
  };
  const addComment = async (taskId, body) => {
    const lowered = body.toLowerCase();
    const mentioned = (members.data ?? [])
      .filter(
        (member) =>
          lowered.includes(
            `@${(member.full_name || member.email).toLowerCase()}`,
          ) || lowered.includes(`@${member.email.split("@")[0].toLowerCase()}`),
      )
      .map((member) => member.id);
    await result(
      supabase.from("task_comments").insert({
        task_id: taskId,
        workspace_id: activeWorkspaceId,
        author_id: user.id,
        body: body.trim(),
        mentioned_user_ids: mentioned,
      }),
    );
  };
  return {
    ...query,
    tasks: query.data ?? [],
    members: members.data ?? [],
    currentUserId: user?.id,
    createTask,
    updateTask,
    deleteTask,
    addComment,
  };
}

export function useTaskComments(taskId) {
  const { activeWorkspaceId } = useAuthWorkspace();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["task-comments", taskId],
    enabled: Boolean(taskId && activeWorkspaceId),
    queryFn: () =>
      result(
        supabase
          .from("task_comments")
          .select("*")
          .eq("task_id", taskId)
          .eq("workspace_id", activeWorkspaceId)
          .order("created_at"),
      ),
  });
  useEffect(() => {
    if (!taskId) return undefined;
    const channel = supabase
      .channel(`task-comments:${taskId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_comments",
          filter: `task_id=eq.${taskId}`,
        },
        () => client.invalidateQueries({ queryKey: ["task-comments", taskId] }),
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [client, taskId]);
  return query;
}

export function useNotifications() {
  const { activeWorkspaceId, user } = useAuthWorkspace();
  const client = useQueryClient();
  const key = ["notifications", activeWorkspaceId, user?.id];
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(activeWorkspaceId && user),
    queryFn: () =>
      result(
        supabase
          .from("notifications")
          .select("*")
          .eq("workspace_id", activeWorkspaceId)
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30),
      ),
  });
  useEffect(() => {
    if (!activeWorkspaceId || !user) return;
    void supabase
      .rpc("refresh_due_task_notifications", {
        p_workspace_id: activeWorkspaceId,
      })
      .then(() =>
        client.invalidateQueries({
          queryKey: ["notifications", activeWorkspaceId, user.id],
        }),
      );
  }, [activeWorkspaceId, client, user]);
  useEffect(() => {
    if (!activeWorkspaceId || !user) return undefined;
    const channel = supabase
      .channel(`notifications:${user.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () =>
          client.invalidateQueries({
            queryKey: ["notifications", activeWorkspaceId, user.id],
          }),
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, client, user]);
  const markAllRead = async () => {
    await result(
      supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .eq("workspace_id", activeWorkspaceId)
        .is("read_at", null),
    );
    await client.invalidateQueries({ queryKey: key });
  };
  const markRead = async (id) => {
    await result(
      supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("recipient_id", user.id),
    );
    await client.invalidateQueries({ queryKey: key });
  };
  return {
    ...query,
    notifications: query.data ?? [],
    unread: (query.data ?? []).filter((item) => !item.read_at).length,
    markAllRead,
    markRead,
  };
}

export function useCalendarEvents(from, to) {
  const { activeWorkspaceId } = useAuthWorkspace();
  return useQuery({
    queryKey: ["calendar-events", activeWorkspaceId, from, to],
    enabled: Boolean(activeWorkspaceId && from && to),
    queryFn: async () => {
      return result(
        supabase.rpc("get_calendar_availability", {
          p_workspace_id: activeWorkspaceId,
          p_from: from,
          p_to: to,
        }),
      );
    },
  });
}
