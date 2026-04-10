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



// ---------------------------------------------------------------------------
// Log file types (from EvalCollector output in packages/bees/hive/logs)
// ---------------------------------------------------------------------------

/** Per-turn boundary recorded by the EvalCollector. */
export interface LogTurnBoundary {
  contextLengthAtStart: number;
  tokenMetadata: LogTurnTokenMetadata | null;
}

/** Token metadata for a single API turn. */
export interface LogTurnTokenMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
  totalTokenCount?: number;
}

/** A single "run" entry from a log.json file. */
export interface LogRunEntry {
  type: "run";
  sessionId: string;
  startedDateTime: string;
  totalDurationMs: number;
  turnCount: number;
  totalRequestTimeMs: number;
  totalThoughts: number;
  totalFunctionCalls: number;
  tokenMetadata: LogTokenMetadata;
  turns: LogTurnBoundary[];
  config: LogConfig;
  context: LogTurn[];
}

/** A single "outcome" entry from a log.json file. */
export interface LogOutcomeEntry {
  type: "outcome";
  outcome: Record<string, unknown>;
}

export interface LogTokenMetadata {
  totalPromptTokens: number;
  totalCandidatesTokens: number;
  totalThoughtsTokens: number;
  totalCachedTokens: number;
  totalTokens: number;
}

export interface LogConfig {
  generationConfig?: Record<string, unknown>;
  toolConfig?: Record<string, unknown>;
  tools?: Array<{
    functionDeclarations?: Array<{ name: string; description?: string }>;
  }>;
  systemInstruction?: { parts: Array<{ text: string }>; role: string };
}

export interface LogTurn {
  role: string;
  parts: LogPart[];
}

/**
 * A part within a conversation turn. A single object can carry multiple
 * fields (e.g. functionCall + thoughtSignature), so this is a flat
 * interface rather than a discriminated union.
 */
export interface LogPart {
  text?: string;
  thought?: boolean;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
    id?: string;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
  thoughtSignature?: string;
}

/** Summary info extracted from a log file (for sidebar display). */
export interface LogFileInfo {
  filename: string;
  sessionId: string;
  startedDateTime: string;
  totalDurationMs: number;
  turnCount: number;
  totalThoughts: number;
  totalFunctionCalls: number;
  totalTokens: number;
}

/** A group of log files sharing the same session/ticket ID. */
export interface LogSession {
  sessionId: string;
  files: LogFileInfo[];
}

/** A single API turn within a segment — its conversation entries + token data. */
export interface TurnGroup {
  turnIndex: number;
  entries: LogTurn[];
  tokenMetadata: LogTurnTokenMetadata | null;
}

/** One run segment within a session — carries per-turn groups. */
export interface SessionSegment {
  filename: string;
  segmentIndex: number;
  startedDateTime: string;
  totalDurationMs: number;
  turnCount: number;
  turnGroups: TurnGroup[];
  totalThoughts: number;
  totalFunctionCalls: number;
  totalTokens: number;
  config: LogConfig;
  tokenMetadata: LogTokenMetadata;
}

/** Unified timeline merging all runs of a session. */
export interface MergedSessionView {
  sessionId: string;
  segments: SessionSegment[];
  totalDurationMs: number;
  totalTurns: number;
  totalThoughts: number;
  totalFunctionCalls: number;
  totalTokens: number;
}
