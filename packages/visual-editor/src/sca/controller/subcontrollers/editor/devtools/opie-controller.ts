/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";
import type { SessionLogEntry } from "../../../../types.js";
import type { FunctionDeclaration } from "../../../../../a2/a2/gemini.js";
import type { LLMContent } from "@breadboard-ai/types";

export class OpieController extends RootController {
  @field()
  private accessor _systemInstruction: string = "";

  @field({ deep: true })
  private accessor _functionDeclarations: FunctionDeclaration[] = [];

  @field({ deep: true })
  private accessor _entries: SessionLogEntry[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSORS
  // ═══════════════════════════════════════════════════════════════════════════

  get systemInstruction(): string {
    return this._systemInstruction;
  }

  get functionDeclarations(): readonly FunctionDeclaration[] {
    return this._functionDeclarations;
  }

  get entries(): readonly SessionLogEntry[] {
    return this._entries;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  setSystemInstruction(instruction: string | LLMContent | null | undefined): void {
    if (!instruction) {
      this._systemInstruction = "";
      return;
    }
    if (typeof instruction === "string") {
      this._systemInstruction = instruction;
    } else if ("parts" in instruction) {
      this._systemInstruction = instruction.parts
        .filter((p): p is { text: string } => "text" in p)
        .map((p) => p.text)
        .join("\n");
    }
  }

  setFunctionDeclarations(declarations: FunctionDeclaration[]): void {
    this._functionDeclarations = [...declarations];
  }

  addObjective(request: string | LLMContent): void {
    let resolvedRequest = "";
    if (typeof request === "string") {
      resolvedRequest = request;
    } else if (request && "parts" in request) {
      resolvedRequest = (request as LLMContent).parts
        .filter((p): p is { text: string } => "text" in p)
        .map((p) => p.text)
        .join("\n");
    }

    const existingIndex = this._entries.findIndex((e) => e.kind === "objective");
    if (existingIndex !== -1) {
      this._entries = this._entries.map((entry, idx) => {
        if (idx === existingIndex) {
          return {
            ...entry,
            args: { ...entry.args, user_request: resolvedRequest },
          };
        }
        return entry;
      });
    } else {
      const entry: SessionLogEntry = {
        callId: crypto.randomUUID(),
        kind: "objective",
        name: "objective",
        args: { user_request: resolvedRequest },
        timestamp: Date.now(),
      };
      this._entries = [...this._entries, entry];
    }
  }

  addThought(text: string): void {
    const entry: SessionLogEntry = {
      callId: crypto.randomUUID(),
      kind: "thought",
      name: "thought",
      args: { thought: text },
      timestamp: Date.now(),
    };
    this._entries = [...this._entries, entry];
  }

  addCall(callId: string, name: string, args: Record<string, unknown>): void {
    const entry: SessionLogEntry = {
      callId,
      kind: "call",
      name,
      args,
      timestamp: Date.now(),
    };
    this._entries = [...this._entries, entry];
  }

  updateCallResponse(callId: string, response: Record<string, unknown> | LLMContent | null | undefined): void {
    let resolvedResponse: Record<string, unknown> | undefined = undefined;
    if (response) {
      if ("parts" in response && Array.isArray((response as LLMContent).parts)) {
        const firstPart = (response as LLMContent).parts[0];
        if (firstPart && "functionResponse" in firstPart) {
          resolvedResponse = firstPart.functionResponse.response as Record<string, unknown>;
        } else {
          resolvedResponse = response as unknown as Record<string, unknown>;
        }
      } else {
        resolvedResponse = response as Record<string, unknown>;
      }
    }

    this._entries = this._entries.map((entry) => {
      if (entry.callId === callId) {
        return { ...entry, response: resolvedResponse };
      }
      return entry;
    });
  }

  clearLog(): void {
    this._entries = [];
    this._systemInstruction = "";
    this._functionDeclarations = [];
  }
}
