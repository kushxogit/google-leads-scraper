import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthWorkspace } from "../context/authWorkspace";
import { fromDbLead } from "./useCrm";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";
const AUTO_APPLY_CONFIDENCE = 0.75;
export const CLIENT_FIELDS = [
  "website",
  "required_service",
  "project_value",
  "last_conversation_at",
  "next_follow_up_at",
  "payment_status",
  "pending_feedback",
  "important_notes",
  "social_links",
];

export function clientFromRow(row) {
  const meta = row?.metadata || {};
  const merged = { ...meta, ...row };
  return {
    ...merged,
    id: row.id,
    business_name: row.name || row.business_name || "Unnamed client",
    website: row.website || meta.website || "",
    required_service: row.required_service || meta.required_service || "",
    project_value: row.project_value ?? meta.project_value ?? "",
    last_conversation_at: row.last_conversation_at || meta.last_conversation_at || null,
    next_follow_up_at: row.next_follow_up_at || meta.next_follow_up_at || meta.follow_up_date || null,
    payment_status: row.payment_status || meta.payment_status || "not_set",
    pending_feedback: row.pending_feedback ?? Boolean(meta.pending_feedback),
    important_notes: row.important_notes || meta.important_notes || meta.remarks || "",
    social_links: row.social_links || meta.social_links || {},
    score: Number(meta.score ?? row.score ?? 0),
  };
}

function requireData(request) {
  return request.then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
}

function clearChannels(prefix) {
  if (!supabase) return;
  supabase
    .getChannels()
    .filter((channel) => channel.topic.includes(`realtime:${prefix}`))
    .forEach((channel) => {
      channel.unsubscribe();
      void supabase.removeChannel(channel);
    });
}

function hasReviewableSuggestions(interaction) {
  return Boolean(
    interaction?.suggested_status
    || interaction?.follow_up_date
    || (interaction?.feedback_status && interaction.feedback_status !== "unchanged")
    || (interaction?.payment_status && interaction.payment_status !== "unchanged"),
  );
}

function interactionDueAt(date) {
  if (!date) return null;
  const parsed = new Date(date + "T09:00:00");
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function useWorkspaceInteractions(leadId) {
  const { activeWorkspaceId, user } = useAuthWorkspace();
  const client = useQueryClient();
  const key = useMemo(() => ["interactions", activeWorkspaceId, leadId || "all"], [activeWorkspaceId, leadId]);
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(activeWorkspaceId),
    queryFn: async () => {
      let request = supabase
        .from("lead_interactions")
        .select("*")
        .eq("workspace_id", activeWorkspaceId)
        .order("created_at", { ascending: false });
      if (leadId) request = request.eq("lead_id", leadId);
      return requireData(request);
    },
  });

  useEffect(() => {
    if (!activeWorkspaceId || !supabase) return undefined;
    const prefix = `lead-interactions:${activeWorkspaceId}`;
    clearChannels(prefix);
    const channel = supabase.channel(`${prefix}:${crypto.randomUUID()}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "lead_interactions", filter: `workspace_id=eq.${activeWorkspaceId}` },
      () => client.invalidateQueries({ queryKey: key }),
    );
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "interaction_processing_jobs", filter: `workspace_id=eq.${activeWorkspaceId}` },
      () => client.invalidateQueries({ queryKey: key }),
    );
    channel.subscribe();
    return () => {
      channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, client, key]);

  const refresh = () => client.invalidateQueries({ queryKey: key });

  const logInteraction = async ({ lead, rawNote, channel = "other" }) => {
    const interaction = await requireData(
      supabase
        .from("lead_interactions")
        .insert({
          lead_id: lead.id,
          workspace_id: activeWorkspaceId,
          author_id: user.id,
          raw_note: rawNote.trim(),
          channel,
          processing_status: "processing",
        })
        .select()
        .single(),
    );
    const metadata = { ...(lead.metadata || {}), last_conversation_at: interaction.created_at };
    await requireData(
      supabase
        .from("leads")
        .update({ last_conversation_at: interaction.created_at, metadata })
        .eq("id", lead.id)
        .eq("workspace_id", activeWorkspaceId),
    );
    await requireData(
      supabase
        .from("interaction_processing_jobs")
        .insert({
          interaction_id: interaction.id,
          lead_id: lead.id,
          workspace_id: activeWorkspaceId,
          status: "processing",
          attempts: 0,
          started_at: new Date().toISOString(),
        }),
    );
    await refresh();
    return interaction;
  };

  const createInteractionTask = async (interaction) => {
    if (!interaction?.next_step?.trim()) return null;
    const existing = await requireData(
      supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", activeWorkspaceId)
        .eq("source_interaction_id", interaction.id)
        .maybeSingle(),
    );
    if (existing) return existing;

    const dueAt = interactionDueAt(interaction.follow_up_date);
    const description = [
      interaction.summary ? "AI summary: " + interaction.summary : "",
      "Source interaction: " + interaction.id,
    ].filter(Boolean).join("\n\n");
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        workspace_id: activeWorkspaceId,
        created_by: user.id,
        lead_id: interaction.lead_id,
        title: interaction.next_step.trim(),
        description,
        category: "follow_up",
        priority: "medium",
        status: dueAt ? "planned" : "unplanned",
        due_at: dueAt,
        source_interaction_id: interaction.id,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return requireData(
          supabase
            .from("tasks")
            .select("*")
            .eq("workspace_id", activeWorkspaceId)
            .eq("source_interaction_id", interaction.id)
            .single(),
        );
      }
      throw error;
    }
    await requireData(
      supabase.from("task_assignees").insert({
        task_id: task.id,
        workspace_id: activeWorkspaceId,
        user_id: user.id,
      }),
    );
    await client.invalidateQueries({ queryKey: ["tasks", activeWorkspaceId] });
    return task;
  };

  const processInteraction = async (interaction, lead) => {
    try {
      const job = await requireData(
        supabase
          .from("interaction_processing_jobs")
          .select("*")
          .eq("interaction_id", interaction.id)
          .single(),
      );
      await requireData(
        supabase
          .from("interaction_processing_jobs")
          .update({
            status: "processing",
            attempts: Number(job.attempts || 0) + 1,
            last_error: null,
            started_at: new Date().toISOString(),
          })
          .eq("id", job.id),
      );
      const response = await fetch(`${apiBase}/api/ai/interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawNote: interaction.raw_note,
          lead: {
            name: lead?.business_name || lead?.name,
            company: lead?.company,
            status: lead?.status,
            service: lead?.required_service,
            paymentStatus: lead?.payment_status,
          },
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "The interaction processor is unavailable.");
      const structured = body?.structured || {};
      await requireData(
        supabase
          .from("lead_interactions")
          .update({
            ...structured,
            ai_payload: structured,
            processing_status: "needs_review",
            processing_error: null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", interaction.id)
          .eq("workspace_id", activeWorkspaceId),
      );
      const processedInteraction = { ...interaction, ...structured };
      const task = await createInteractionTask(processedInteraction);
      const reviewRequired = hasReviewableSuggestions(processedInteraction);
      let finalStatus = "needs_review";
      if (Number(structured.ai_confidence) >= AUTO_APPLY_CONFIDENCE) {
        await applyInteraction({
          interaction: processedInteraction,
          lead,
          automatic: true,
          createTask: false,
          statusOverride: reviewRequired ? "needs_review" : "applied",
        });
        finalStatus = reviewRequired ? "needs_review" : "applied";
      }
      await requireData(
        supabase
          .from("interaction_processing_jobs")
          .update({
            status: finalStatus,
            last_error: null,
            completed_at: new Date().toISOString(),
          })
          .eq("interaction_id", interaction.id),
      );
      await refresh();
      return { ...processedInteraction, processing_status: finalStatus, task };
    } catch (error) {
      await requireData(
        supabase.from("lead_interactions").update({
          processing_status: "failed",
          processing_error: error.message || "Processing failed.",
          automation_error: error.message || "Processing failed.",
        }).eq("id", interaction.id).eq("workspace_id", activeWorkspaceId),
      ).catch(() => {});
      await requireData(
        supabase.from("interaction_processing_jobs").update({
          status: "failed",
          last_error: error.message || "Processing failed.",
          next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
        }).eq("interaction_id", interaction.id),
      ).catch(() => {});
      await refresh();
      throw error;
    }
  };

  const retryInteraction = async (interaction, lead) => {
    await requireData(
      supabase.from("lead_interactions").update({
        processing_status: "processing",
        processing_error: null,
        automation_error: null,
        reviewed_at: null,
        dismissed_at: null,
      }).eq("id", interaction.id).eq("workspace_id", activeWorkspaceId),
    );
    await requireData(
      supabase.from("interaction_processing_jobs").update({
        status: "processing",
        last_error: null,
        next_attempt_at: null,
      }).eq("interaction_id", interaction.id),
    );
    await refresh();
    return processInteraction(interaction, lead);
  };

  const applyInteraction = async ({
    interaction,
    lead,
    overrides = {},
    automatic = false,
    createTask = true,
    statusOverride = null,
  }) => {
    const protectedFields = new Set(interaction.manually_edited_fields || []);
    const suggestions = { ...interaction, ...overrides };
    const patch = {};
    if (!protectedFields.has("required_service") && suggestions.service) {
      patch.required_service = suggestions.service;
    }
    if (!automatic) {
      if (!protectedFields.has("status") && suggestions.suggested_status) patch.status = suggestions.suggested_status;
      if (!protectedFields.has("next_follow_up_at") && suggestions.follow_up_date) {
        patch.next_follow_up_at = new Date(suggestions.follow_up_date).toISOString();
      }
      if (!protectedFields.has("pending_feedback") && suggestions.feedback_status && suggestions.feedback_status !== "unchanged") {
        patch.pending_feedback = suggestions.feedback_status === "pending";
      }
      if (!protectedFields.has("payment_status") && suggestions.payment_status && suggestions.payment_status !== "unchanged") {
        patch.payment_status = suggestions.payment_status;
      }
    }
    if (!protectedFields.has("last_conversation_at")) {
      patch.last_conversation_at = interaction.created_at || new Date().toISOString();
    }
    const metadata = { ...(lead.metadata || {}) };
    Object.entries(patch).forEach(([field, value]) => { metadata[field] = value; });
    await requireData(
      supabase.from("leads").update({ ...patch, metadata }).eq("id", lead.id).eq("workspace_id", activeWorkspaceId),
    );
    const linkedTask = createTask ? await createInteractionTask(suggestions) : null;
    const nextStatus = statusOverride || "applied";
    const reviewedAt = nextStatus === "applied" ? new Date().toISOString() : null;
    await requireData(
      supabase.from("lead_interactions").update({
        processing_status: nextStatus,
        reviewed_at: reviewedAt,
        processing_error: null,
        automation_error: null,
      }).eq("id", interaction.id).eq("workspace_id", activeWorkspaceId),
    );
    await requireData(
      supabase.from("interaction_processing_jobs").update({
        status: nextStatus,
        completed_at: new Date().toISOString(),
        last_error: null,
      }).eq("interaction_id", interaction.id),
    );
    await client.invalidateQueries({ queryKey: ["leads", activeWorkspaceId] });
    await refresh();
    return linkedTask;
  };

  const reviewInteraction = async (interaction, dismissed = false) => {
    const reviewedAt = new Date().toISOString();
    await requireData(
      supabase
        .from("lead_interactions")
        .update({
          reviewed_at: reviewedAt,
          dismissed_at: dismissed ? reviewedAt : null,
        })
        .eq("id", interaction.id)
        .eq("workspace_id", activeWorkspaceId),
    );
    await refresh();
  };

  const saveQuickInteraction = async ({ lead, channel, outcome, note, nextStep, followUpDate }) => {
    const stages = { "No reply": "contacted", Spoke: "contacted", Interested: "qualified", "Not interested": "lost", "Proposal requested": "proposal", Won: "won" };
    const status = stages[outcome] || lead.status; const closed = status === "lost" || status === "won";
    const followUpAt = !closed && followUpDate ? interactionDueAt(followUpDate) : null;
    const interaction = await requireData(supabase.from("lead_interactions").insert({ lead_id: lead.id, workspace_id: activeWorkspaceId, author_id: user.id, raw_note: note.trim() || outcome, channel, outcome, next_step: nextStep || null, follow_up_date: followUpDate || null, suggested_status: status, processing_status: "applied", reviewed_at: new Date().toISOString(), processed_at: new Date().toISOString() }).select().single());
    const metadata = { ...(lead.metadata || {}), last_conversation_at: interaction.created_at, next_follow_up_at: followUpAt };
    await requireData(supabase.from("leads").update({ status, last_conversation_at: interaction.created_at, next_follow_up_at: followUpAt, metadata }).eq("id", lead.id).eq("workspace_id", activeWorkspaceId));
    await client.invalidateQueries({ queryKey: ["leads", activeWorkspaceId] }); await refresh(); return interaction;
  };
  return {
    ...query,
    interactions: query.data || [],
    logInteraction,
    saveQuickInteraction,
    processInteraction,
    retryInteraction,
    applyInteraction,
    reviewInteraction,
    refresh,
  };
}

export function useClientActions() {
  const { activeWorkspaceId } = useAuthWorkspace();
  const client = useQueryClient();
  const updateClient = async (lead, changes) => {
    const next = { ...lead, ...changes };
    const metadata = { ...(lead.metadata || {}) };
    CLIENT_FIELDS.forEach((field) => {
      if (changes[field] !== undefined) metadata[field] = changes[field];
    });
    const payload = {
      name: next.business_name || next.name || "Unnamed client",
      phone: next.phone || null,
      email: next.email || null,
      company: next.company || null,
      website: next.website || null,
      required_service: next.required_service || null,
      project_value: next.project_value === "" ? null : (next.project_value == null ? null : Number(next.project_value)),
      last_conversation_at: next.last_conversation_at || null,
      next_follow_up_at: next.next_follow_up_at || null,
      payment_status: next.payment_status || "not_set",
      pending_feedback: Boolean(next.pending_feedback),
      important_notes: next.important_notes || null,
      social_links: next.social_links || {},
      status: next.status,
      metadata,
    };
    const { data, error } = await supabase.from("leads").update(payload).eq("id", lead.id).eq("workspace_id", activeWorkspaceId).select().single();
    if (error) throw error;
    const manuallyEdited = [
      ...CLIENT_FIELDS.filter((field) => changes[field] !== undefined),
      ...(changes.status !== undefined ? ["status"] : []),
    ];
    if (manuallyEdited.length) {
      try {
        const pending = await requireData(
          supabase
            .from("lead_interactions")
            .select("id, manually_edited_fields")
            .eq("lead_id", lead.id)
            .eq("workspace_id", activeWorkspaceId)
            .in("processing_status", ["processing", "needs_review", "failed"]),
        );
        await Promise.all((pending || []).map((interaction) =>
          requireData(
            supabase
              .from("lead_interactions")
              .update({
                manually_edited_fields: [
                  ...new Set([...(interaction.manually_edited_fields || []), ...manuallyEdited]),
                ],
              })
              .eq("id", interaction.id),
          ),
        ));
      } catch {
        // The client record remains saved even when the optional review marker is unavailable.
      }
    }
    await client.invalidateQueries({ queryKey: ["leads", activeWorkspaceId] });
    return fromDbLead(data);
  };
  return { updateClient };
}



