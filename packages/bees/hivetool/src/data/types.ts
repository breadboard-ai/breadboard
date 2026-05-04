/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Re-export the shared backend API contract.
export type { TaskData as TicketData } from "../../../common/types.js";

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

// ---------------------------------------------------------------------------
// Surface schema types (from docs/surface-schema.md)
// ---------------------------------------------------------------------------

/** A named group within a surface manifest. */
export interface SurfaceSection {
  id: string;
  title: string;
  description?: string;
  /** When true, this section is selected by default in tabbed views. */
  active?: boolean;
}

/** A content leaf in a surface manifest. */
export interface SurfaceItem {
  id: string;
  title: string;
  path?: string;
  description?: string;
  render?: string;
  role?: string;
  section?: string;
}

/** Parsed surface.json — the agent's curated presentation manifest. */
export interface SurfaceManifest {
  version: number;
  title?: string;
  sections?: SurfaceSection[];
  items: SurfaceItem[];
}

