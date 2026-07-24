/**
 * Shared Type Contract between Codex (Backend) and Antigravity (Frontend).
 * Codex generates and updates this file when designing API contracts.
 * Antigravity imports types from this file for client-side API calls.
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Example contract interface placeholder:
export interface Lead {
  id: string;
  workspaceId: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status: PipelineStatus;
  assignedTo?: string | null;
  metadata: LeadMetadata;
  createdAt: string;
}

export type PipelineStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "won"
  | "lost";

/** Values live in `leads.metadata`, keyed by a workspace field definition key. */
export interface LeadMetadata {
  [key: string]: unknown;
  scrape_job_id?: number;
}

export type LeadFieldType = "text" | "number" | "date" | "select" | "url";

export interface LeadFieldDefinition {
  id: string;
  workspaceId: string;
  key: string;
  label: string;
  fieldType: LeadFieldType;
  options: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeadTag {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface SavedPipelineView {
  id: string;
  workspaceId: string;
  name: string;
  visibility: "personal" | "workspace";
  filters: PipelineViewFilters;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Omit a field to leave that dimension unfiltered. */
export interface PipelineViewFilters {
  statuses?: PipelineStatus[];
  assigneeIds?: string[];
  tagIds?: string[];
  source?: "scraped" | "manual" | "all";
  workState?: "needs_action" | "overdue" | "planned" | "all";
  scrapeJobIds?: number[];
}

export interface LeadTimelineEvent {
  id: string;
  leadId: string;
  taskId: string | null;
  actorId: string | null;
  source: "lead" | "task";
  eventType: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ScrapeJobSummary {
  id: number;
  query: string;
  status: "queued" | "running" | "completed" | "failed";
  foundCount: number;
  savedCount: number;
  duplicateCount: number;
  reviewedAt: string | null;
  createdAt: string;
  finishedAt: string | null;
}
