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
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  createdAt: string;
}
