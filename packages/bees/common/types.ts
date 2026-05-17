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
export interface TaskData {
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
  runner?: "generate" | "live" | "direct_model";
  voice?: string;
  active_session?: string;
  options?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Project Swarm — decoupled entity types
// ---------------------------------------------------------------------------

/**
 * Agent data — a persistent identity with session, workspace, and tools.
 *
 * Mirrors the ``agents`` SQL table from Project Swarm. Agents own
 * configuration and lifecycle; work items are separate TaskItemData.
 */
export interface AgentData {
  id: string;
  type: string;
  slug: string;
  status: string;
  finite: boolean;
  parent_id?: string;
  workspace_root_id?: string;
  active_session?: string;
  model?: string;
  runner?: "generate" | "live" | "direct_model";
  voice?: string;
  functions?: string[];
  skills?: string[];
  tags?: string[];
  playbook_id?: string;
  tasks?: string[];
  created_at?: string;
  completed_at?: string;
}

/**
 * Lightweight task data — a work item assigned to an agent.
 *
 * Mirrors the ``tasks`` SQL table from Project Swarm. Tasks carry an
 * objective and outcome, but no session or workspace.
 */
export interface TaskItemData {
  id: string;
  objective: string;
  status: string;
  assignee?: string;
  created_by?: string;
  kind?: string;
  title?: string;
  outcome?: string;
  outcome_content?: Record<string, unknown>;
  context?: string;
  tags?: string[];
  depends_on?: string[];
  created_at?: string;
  completed_at?: string;
}
