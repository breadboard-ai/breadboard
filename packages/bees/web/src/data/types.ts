/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
  parent_ticket_id?: string;
  kind?: string;
  signal_type?: string;
  context?: string;
  delivered_to?: string[];
  chat_history?: Array<{ role: string; text: string }>;
}

export interface PlaybookData {
  name: string;
  title: string;
  description: string;
}
