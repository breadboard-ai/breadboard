/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Backend API contract for ticket data. Shared between Opal shell and
 * HiveTool devtools — any additions here must be reflected in the Python
 * server's serialisation logic.
 */
export interface TicketData {
  id: string;
  objective: string;
  status: string;
  created_at?: string;
  completed_at?: string;
  turns?: number;
  thoughts?: number;
  outcome?: string;
  error?: string;
  assignee?: string;
  suspend_event?: Record<string, unknown>;
  depends_on?: string[];
  events_log?: Array<Record<string, unknown>>;
  tags?: string[];
  functions?: string[];
  skills?: string[];
  title?: string;
  playbook_id?: string;
  playbook_run_id?: string;
  owning_task_id?: string;
  parent_task_id?: string;
  /** Legacy fallback creator_ticket_id -> parent_task_id */
  creator_ticket_id?: string;
  slug?: string;
  kind?: string;
  signal_type?: string;
  context?: string;
  delivered_to?: string[];
  chat_history?: Array<{ role: string; text: string }>;
  model?: string;
  watch_events?: Array<{ type: string }>;
  outcome_content?: Record<string, unknown>;
  files?: Array<{ path: string; mimeType: string; localPath: string }>;
}
