import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthWorkspace } from "../context/authWorkspace";

export const PIPELINE_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
];
const leadKey = (workspaceId) => ["leads", workspaceId];
const metadataKeys = [
  "niche",
  "area",
  "website",
  "address",
  "rating",
  "reviews",
  "source_url",
  "score",
  "score_breakdown",
  "recommended_offer",
  "follow_up_date",
  "remarks",
];

export function fromDbLead(row) {
  if (!row) return row;
  const meta = row.metadata ?? {};
  return {
    ...row,
    business_name: row.name,
    ...meta,
    score: Number(meta.score ?? 0),
    called: row.status === "contacted" ? 1 : 0,
  };
}

export function toDbLead(input, userId) {
  const metadata = { ...(input.metadata ?? {}) };
  metadataKeys.forEach((key) => {
    if (input[key] !== undefined) metadata[key] = input[key];
  });
  return {
    name: input.name ?? input.business_name ?? "Unnamed Lead",
    phone: input.phone || null,
    email: input.email || null,
    company: input.company || null,
    source: input.source || "manual",
    status: PIPELINE_STATUSES.includes(input.status) ? input.status : "new",
    assigned_to: input.assigned_to || null,
    metadata,
    ...(userId ? { created_by: userId } : {}),
  };
}

async function requireResult(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

function clearRealtimeChannels(prefix) {
  supabase
    .getChannels()
    .filter((channel) => channel.topic.includes(`realtime:${prefix}`))
    .forEach((channel) => {
      channel.unsubscribe();
      void supabase.removeChannel(channel);
    });
}

export function useWorkspaceLeads() {
  const { activeWorkspaceId, user } = useAuthWorkspace();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: leadKey(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId),
    queryFn: async () =>
      (
        await requireResult(
          supabase
            .from("leads")
            .select("*")
            .eq("workspace_id", activeWorkspaceId)
            .order("created_at", { ascending: false }),
        )
      ).map(fromDbLead),
  });
  useEffect(() => {
    if (!activeWorkspaceId) return undefined;
    const prefix = `leads:${activeWorkspaceId}`;
    clearRealtimeChannels(prefix);
    const channel = supabase.channel(`${prefix}:${crypto.randomUUID()}`);
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "leads",
        filter: `workspace_id=eq.${activeWorkspaceId}`,
      },
      () => client.invalidateQueries({ queryKey: leadKey(activeWorkspaceId) }),
    );
    channel.subscribe();
    return () => {
      channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, client]);
  const refresh = () =>
    client.invalidateQueries({ queryKey: leadKey(activeWorkspaceId) });
  const addLead = async (input) => {
    const data = await requireResult(
      supabase
        .from("leads")
        .insert({
          ...toDbLead(input, user.id),
          workspace_id: activeWorkspaceId,
        })
        .select()
        .single(),
    );
    await refresh();
    return fromDbLead(data);
  };
  const updateLead = async (id, changes) => {
    const existing = query.data?.find((lead) => lead.id === id);
    const payload = toDbLead({ ...existing, ...changes });
    delete payload.created_by;
    await requireResult(
      supabase
        .from("leads")
        .update(payload)
        .eq("id", id)
        .eq("workspace_id", activeWorkspaceId),
    );
    await refresh();
  };
  const deleteLead = async (id) => {
    await requireResult(
      supabase
        .from("leads")
        .delete()
        .eq("id", id)
        .eq("workspace_id", activeWorkspaceId),
    );
    await refresh();
  };
  const bulkUpdate = async ({ ids, status, assignedTo, remove }) => {
    await requireResult(
      supabase.rpc("bulk_update_leads", {
        p_workspace_id: activeWorkspaceId,
        p_lead_ids: ids,
        p_status: status ?? null,
        p_assigned_to: assignedTo ?? null,
        p_delete: Boolean(remove),
      }),
    );
    await refresh();
  };
  return {
    ...query,
    leads: query.data ?? [],
    addLead,
    updateLead,
    deleteLead,
    bulkUpdate,
    workspaceId: activeWorkspaceId,
  };
}

export function useLeadDetail(leadId) {
  const { activeWorkspaceId } = useAuthWorkspace();
  const client = useQueryClient();
  const lead = useQuery({
    queryKey: ["lead", activeWorkspaceId, leadId],
    enabled: Boolean(activeWorkspaceId && leadId),
    queryFn: async () =>
      fromDbLead(
        await requireResult(
          supabase
            .from("leads")
            .select("*")
            .eq("id", leadId)
            .eq("workspace_id", activeWorkspaceId)
            .single(),
        ),
      ),
  });
  const notes = useQuery({
    queryKey: ["notes", leadId],
    enabled: Boolean(leadId),
    queryFn: () =>
      requireResult(
        supabase
          .from("lead_notes")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at"),
      ),
  });
  const activity = useQuery({
    queryKey: ["activity", leadId],
    enabled: Boolean(leadId),
    queryFn: () =>
      requireResult(
        supabase
          .from("lead_activity")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false }),
      ),
  });
  const timeline = useQuery({
    queryKey: ["lead-timeline", leadId],
    enabled: Boolean(leadId),
    queryFn: () =>
      requireResult(
        supabase.rpc("get_lead_timeline", { p_lead_id: leadId }),
      ),
  });
  const members = useQuery({
    queryKey: ["members", activeWorkspaceId],
    enabled: Boolean(activeWorkspaceId),
    queryFn: () =>
      requireResult(
        supabase.rpc("get_workspace_members", {
          p_workspace_id: activeWorkspaceId,
        }),
      ),
  });
  useEffect(() => {
    if (!leadId) return undefined;
    const prefix = `lead-detail:${leadId}`;
    clearRealtimeChannels(prefix);
    const channel = supabase.channel(`${prefix}:${crypto.randomUUID()}`);
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "lead_notes",
        filter: `lead_id=eq.${leadId}`,
      },
      () => client.invalidateQueries({ queryKey: ["notes", leadId] }),
    );
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "lead_activity",
        filter: `lead_id=eq.${leadId}`,
      },
      () => client.invalidateQueries({ queryKey: ["activity", leadId] }),
    );
    channel.subscribe();
    return () => {
      channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [client, leadId]);
  return { lead, notes, activity, timeline, members };
}

export function useWorkspaceMembers() {
  const { activeWorkspaceId } = useAuthWorkspace();
  return useQuery({
    queryKey: ["members", activeWorkspaceId],
    enabled: Boolean(activeWorkspaceId),
    queryFn: () =>
      requireResult(
        supabase.rpc("get_workspace_members", {
          p_workspace_id: activeWorkspaceId,
        }),
      ),
  });
}

export async function addLeadNote({ leadId, workspaceId, authorId, body }) {
  return requireResult(
    supabase
      .from("lead_notes")
      .insert({
        lead_id: leadId,
        workspace_id: workspaceId,
        author_id: authorId,
        body,
      })
      .select()
      .single(),
  );
}
export async function trackWhatsAppClick(leadId) {
  return requireResult(
    supabase.rpc("record_whatsapp_click", { p_lead_id: leadId }),
  );
}

export async function trackOutreachDraft(leadId, channel) {
  return requireResult(
    supabase.rpc("record_lead_outreach_action", {
      p_lead_id: leadId,
      p_channel: channel,
    }),
  );
}

export function useWorkspaceLeadTags() {
  const { activeWorkspaceId } = useAuthWorkspace();
  const client = useQueryClient();
  const key = ["lead-tags", activeWorkspaceId];
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(activeWorkspaceId),
    queryFn: async () => {
      const [tags, links] = await Promise.all([
        requireResult(
          supabase
            .from("workspace_lead_tags")
            .select("*")
            .eq("workspace_id", activeWorkspaceId)
            .order("name"),
        ),
        requireResult(
          supabase
            .from("lead_tag_links")
            .select("lead_id, tag_id")
            .eq("workspace_id", activeWorkspaceId),
        ),
      ]);
      return tags.map((tag) => ({
        ...tag,
        lead_ids: links
          .filter((link) => link.tag_id === tag.id)
          .map((link) => link.lead_id),
      }));
    },
  });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const createTag = async ({ name, color = "violet" }) => {
    const tag = await requireResult(
      supabase
        .from("workspace_lead_tags")
        .insert({ workspace_id: activeWorkspaceId, name: name.trim(), color })
        .select()
        .single(),
    );
    await refresh();
    return tag;
  };
  const setLeadTags = async (leadId, tagIds) => {
    await requireResult(
      supabase
        .from("lead_tag_links")
        .delete()
        .eq("workspace_id", activeWorkspaceId)
        .eq("lead_id", leadId),
    );
    if (tagIds.length) {
      await requireResult(
        supabase.from("lead_tag_links").insert(
          [...new Set(tagIds)].map((tagId) => ({
            workspace_id: activeWorkspaceId,
            lead_id: leadId,
            tag_id: tagId,
          })),
        ),
      );
    }
    await refresh();
  };
  return { ...query, tags: query.data ?? [], createTag, setLeadTags };
}

export function usePipelineViews() {
  const { activeWorkspaceId, user } = useAuthWorkspace();
  const client = useQueryClient();
  const key = ["pipeline-views", activeWorkspaceId, user?.id];
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(activeWorkspaceId && user),
    queryFn: () =>
      requireResult(
        supabase
          .from("saved_pipeline_views")
          .select("*")
          .eq("workspace_id", activeWorkspaceId)
          .order("updated_at", { ascending: false }),
      ),
  });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const createView = async ({ name, filters, visibility = "personal" }) => {
    const view = await requireResult(
      supabase
        .from("saved_pipeline_views")
        .insert({
          workspace_id: activeWorkspaceId,
          created_by: user.id,
          name: name.trim(),
          filters,
          visibility,
        })
        .select()
        .single(),
    );
    await refresh();
    return view;
  };
  const deleteView = async (id) => {
    await requireResult(
      supabase.from("saved_pipeline_views").delete().eq("id", id),
    );
    await refresh();
  };
  return { ...query, views: query.data ?? [], createView, deleteView };
}
