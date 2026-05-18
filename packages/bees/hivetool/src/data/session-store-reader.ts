/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StateAccess } from "./state-access.js";

import type { SessionSegment, TurnGroup, LogTurnTokenMetadata, LogConfig, LogPart } from "./types.js";

export { SessionStoreReader, compileEventsToSegment };
export type { SessionLineageInfo, TurnCheckpointInfo, TaskCompletionInfo };

interface TurnCheckpointInfo {
  turn: number;
  context_length: number;
  file_system: Record<string, unknown> | null;
  token_metadata: Record<string, unknown> | null;
}

interface TaskCompletionInfo {
  task_id: string;
  turn: number;
  completed_at: string;
}

interface SessionLineageInfo {
  sessionId: string;
  status: string;
  eventCount: number;
  forkedFrom?: { session: string; at_turn: number };
  forkedTo?: { session: string; at_turn: number };
}

interface LineageJson {
  forked_from?: { session: string; at_turn: number };
  forked_to?: { session: string; at_turn: number };
}

function compileEventsToSegment(sessionId: string, events: Record<string, unknown>[], runnerType?: string): SessionSegment {
  let turnCount = 0;
  let totalThoughts = 0;
  let totalFunctionCalls = 0;
  let totalTokens = 0;
  
  let totalPromptTokens = 0;
  let totalCandidatesTokens = 0;
  let totalThoughtsTokens = 0;
  let totalCachedTokens = 0;
  
  let systemInstruction: LogConfig["systemInstruction"] = undefined;
  let tools: LogConfig["tools"] = [];
  const turnGroups: TurnGroup[] = [];
  
  let currentTurnGroup: TurnGroup | null = null;
  let currentTurnIndex = 0;

  for (const event of events) {
    if ("sendRequest" in event) {
      const sendRequest = event.sendRequest as Record<string, unknown> || {};
      const body = sendRequest.body as Record<string, unknown> || {};
      
      const config = { ...body };
      delete config.contents;
      if (config.systemInstruction) {
        systemInstruction = config.systemInstruction as LogConfig["systemInstruction"];
      }
      if (config.tools) {
        tools = config.tools as LogConfig["tools"];
      }
      
      currentTurnGroup = {
        turnIndex: currentTurnIndex++,
        entries: [],
        tokenMetadata: null
      };
      turnGroups.push(currentTurnGroup);
      turnCount++;

      // Parse the incoming user turn / resume turn from sendRequest history
      const contents = body.contents as Array<Record<string, unknown>> || [];
      if (contents.length > 0) {
        const lastTurn = contents[contents.length - 1];
        if (lastTurn && lastTurn.role === "user") {
          const rawParts = lastTurn.parts as unknown[] || [];
          const parts: LogPart[] = rawParts.map((p) => {
            const rawPart = p as Record<string, unknown>;
            const part: LogPart = {};
            if (rawPart.text !== undefined) {
              part.text = rawPart.text as string;
            }
            if (rawPart.functionResponse) {
              const fr = rawPart.functionResponse as Record<string, unknown>;
              part.functionResponse = {
                name: fr.name as string || "",
                response: fr.response as Record<string, unknown> || {}
              };
            }
            return part;
          });
          currentTurnGroup.entries.push({
            role: "user",
            parts
          });
        }
      }
    }
    
    if (currentTurnGroup) {
      if ("thought" in event) {
        const thought = event.thought as Record<string, unknown> || {};
        const text = thought.text as string || "";
        currentTurnGroup.entries.push({
          role: "model",
          parts: [{ text, thought: true }]
        });
        totalThoughts++;
      }
      
      if ("systemMessage" in event) {
        const sm = event.systemMessage as Record<string, unknown> || {};
        const text = sm.text as string || "";
        currentTurnGroup.entries.push({
          role: "model",
          parts: [{ text, systemMessage: true }]
        });
      }
      
      if ("functionCall" in event) {
        const fc = event.functionCall as Record<string, unknown> || {};
        currentTurnGroup.entries.push({
          role: "model",
          parts: [{
            functionCall: {
              name: fc.name as string || "",
              args: fc.args as Record<string, unknown> || {},
              id: fc.id as string
            }
          }]
        });
        totalFunctionCalls++;
      }
      
      if ("usageMetadata" in event) {
        const usageMetadata = event.usageMetadata as Record<string, unknown> || {};
        const metadata = usageMetadata.metadata as Record<string, unknown> || {};
        currentTurnGroup.tokenMetadata = metadata as unknown as LogTurnTokenMetadata;
        
        totalPromptTokens += (metadata.promptTokenCount as number) || 0;
        totalCandidatesTokens += (metadata.candidatesTokenCount as number) || 0;
        totalThoughtsTokens += (metadata.thoughtsTokenCount as number) || 0;
        totalCachedTokens += (metadata.cachedContentTokenCount as number) || 0;
        totalTokens += (metadata.totalTokenCount as number) || 0;
      }

      if ("complete" in event && runnerType !== "generate") {
        const complete = event.complete as Record<string, unknown> || {};
        const result = complete.result as Record<string, unknown> || {};
        const outcomes = result.outcomes as Record<string, unknown> || {};
        const parts = outcomes.parts as Array<Record<string, unknown>> || [];

        const intermediate = result.intermediate as Array<Record<string, unknown>> || [];
        const intermediateParts: LogPart[] = [];

        for (const item of intermediate) {
          const content = item.content as Record<string, unknown> || {};
          if ("text" in content) {
            intermediateParts.push({
              text: content.text as string
            });
          } else if ("inlineData" in content) {
            intermediateParts.push({
              inlineData: content.inlineData as { mimeType: string; data: string }
            });
          }
        }

        const finalParts = intermediateParts.length > 0 ? intermediateParts : (parts as LogPart[]);

        if (currentTurnGroup && finalParts.length > 0) {
          currentTurnGroup.entries.push({
            role: "model",
            parts: finalParts
          });
        }
      }
    }
  }

  return {
    filename: "events.jsonl",
    segmentIndex: 0,
    startedDateTime: new Date().toISOString(),
    totalDurationMs: 0,
    turnCount,
    turnGroups,
    totalThoughts,
    totalFunctionCalls,
    totalTokens,
    config: {
      systemInstruction,
      tools
    },
    tokenMetadata: {
      totalPromptTokens,
      totalCandidatesTokens,
      totalThoughtsTokens,
      totalCachedTokens,
      totalTokens
    }
  };
}

class SessionStoreReader {
  constructor(private access: StateAccess) {}

  /**
   * Resolve the directory handle for an entity by ID.
   *
   * Tries `agents/{id}` first (Project Swarm layout), then falls back
   * to `tickets/{id}` (legacy layout).
   */
  async #getEntityDir(entityId: string): Promise<FileSystemDirectoryHandle | null> {
    // Try agents/ first.
    const agentsHandle = await this.access.getSubdirectory("agents");
    if (agentsHandle) {
      try {
        return await agentsHandle.getDirectoryHandle(entityId);
      } catch {
        // Not in agents/, try tickets/.
      }
    }
    // Fall back to tickets/.
    const ticketsHandle = await this.access.getSubdirectory("tickets");
    if (ticketsHandle) {
      try {
        return await ticketsHandle.getDirectoryHandle(entityId);
      } catch {
        return null;
      }
    }
    return null;
  }

  async findTicketForSession(sessionId: string): Promise<string | null> {
    // Search agents/ first, then tickets/.
    for (const dirName of ["agents", "tickets"]) {
      const dirHandle = await this.access.getSubdirectory(dirName);
      if (!dirHandle) continue;
      try {
        for await (const [name, entry] of (
          dirHandle as FileSystemDirectoryHandle & {
            entries(): AsyncIterable<[string, FileSystemHandle]>;
          }
        ).entries()) {
          if (entry.kind !== "directory") continue;
          const entityDir = await dirHandle.getDirectoryHandle(name);
          try {
            const sessionsDir = await entityDir.getDirectoryHandle("sessions");
            await sessionsDir.getDirectoryHandle(sessionId);
            return name;
          } catch {
            // Not in this entity
          }
        }
      } catch {
        // Ignore scanning errors
      }
    }
    return null;
  }

  async readLineage(ticketId: string): Promise<SessionLineageInfo[]> {
    const entityDir = await this.#getEntityDir(ticketId);
    if (!entityDir) return [];

    try {
      const sessionsDir = await entityDir.getDirectoryHandle("sessions");
      const result: SessionLineageInfo[] = [];

      for await (const [name, entry] of (
        sessionsDir as FileSystemDirectoryHandle & {
          entries(): AsyncIterable<[string, FileSystemHandle]>;
        }
      ).entries()) {
        if (entry.kind !== "directory") continue;
        const sessionDir = await sessionsDir.getDirectoryHandle(name);
        
        const status = (await this.#readText(sessionDir, "status"))?.trim() ?? "unknown";
        const lineage = await this.#readJson(sessionDir, "lineage.json") as LineageJson | null;
        
        let eventCount = 0;
        try {
          const eventsText = await this.#readText(sessionDir, "events.jsonl");
          if (eventsText) {
            eventCount = eventsText.split("\n").filter(Boolean).length;
          }
        } catch {
          // Ignore read errors for event count
        }

        result.push({
          sessionId: name,
          status,
          eventCount,
          forkedFrom: lineage?.forked_from,
          forkedTo: lineage?.forked_to,
        });
      }

      return result;
    } catch {
      return [];
    }
  }

  async readTurns(ticketId: string, sessionId: string): Promise<TurnCheckpointInfo[]> {
    const entityDir = await this.#getEntityDir(ticketId);
    if (!entityDir) return [];
    try {
      const sessionsDir = await entityDir.getDirectoryHandle("sessions");
      const sessionDir = await sessionsDir.getDirectoryHandle(sessionId);
      const turns = await this.#readJson(sessionDir, "turns.json");
      if (Array.isArray(turns)) {
        return turns as TurnCheckpointInfo[];
      }
      return [];
    } catch {
      return [];
    }
  }

  async readEvents(ticketId: string, sessionId: string): Promise<unknown[]> {
    const entityDir = await this.#getEntityDir(ticketId);
    if (!entityDir) return [];
    try {
      const sessionsDir = await entityDir.getDirectoryHandle("sessions");
      const sessionDir = await sessionsDir.getDirectoryHandle(sessionId);
      const text = await this.#readText(sessionDir, "events.jsonl");
      if (!text) return [];
      return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  async readInteraction(ticketId: string, sessionId: string): Promise<unknown | null> {
    const entityDir = await this.#getEntityDir(ticketId);
    if (!entityDir) return null;
    try {
      const sessionsDir = await entityDir.getDirectoryHandle("sessions");
      const sessionDir = await sessionsDir.getDirectoryHandle(sessionId);
      return await this.#readJson(sessionDir, "interaction.json");
    } catch {
      return null;
    }
  }

  async readTaskCompletions(ticketId: string, sessionId: string): Promise<TaskCompletionInfo[]> {
    const entityDir = await this.#getEntityDir(ticketId);
    if (!entityDir) return [];
    try {
      const sessionsDir = await entityDir.getDirectoryHandle("sessions");
      const sessionDir = await sessionsDir.getDirectoryHandle(sessionId);
      const data = await this.#readJson(sessionDir, "task_completions.json");
      if (Array.isArray(data)) {
        return data as TaskCompletionInfo[];
      }
      return [];
    } catch {
      return [];
    }
  }

  async #readJson(
    dir: FileSystemDirectoryHandle,
    filename: string
  ): Promise<unknown | null> {
    try {
      const fileHandle = await dir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async #readText(
    dir: FileSystemDirectoryHandle,
    filename: string
  ): Promise<string | null> {
    try {
      const fileHandle = await dir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }
}
