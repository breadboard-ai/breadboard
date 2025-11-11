/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";
import { Har } from "har-format";
import { GeminiAPIOutputs, GeminiBody } from "../src/a2/gemini";

export { collateContexts };

/**
 * The final, rich report for each unique conversation chain.
 */
export interface FinalChainReport {
  /**
   * Tye of the entry, always "context"
   */
  type: "context";
  /**
   * The timestamp of the *first* request in this chain.
   */
  startedDateTime: string;

  /**
   * The total wall-clock duration from the start of the
   * first request to the end of the final response.
   */
  totalDurationMs: number;

  /**
   * The total number of LLM "turns" (requests) in this chain.
   */
  turnCount: number;

  /**
   * The sum of all request 'time' fields in the chain.
   * This is the total time spent waiting for network responses.
   */
  totalRequestTimeMs: number;

  /**
   * The total number of thoughts
   */
  totalThoughts: number;

  /**
   * The total number of functionCalls
   */
  totalFunctionCalls: number;

  /**
   * The full conversation context (including final response).
   */
  context: LLMContent[];
}

type InternalTurn = {
  startedDateTime: string;
  timeMs: number;
  requestContext: LLMContent[];
  responseParts: DataPart[];
  contextKey: string;
};

class ConvoNode {
  turn: InternalTurn;
  children: ConvoNode[] = [];

  initialStartedDateTime: string;
  turnCount: number;
  totalRequestTimeMs: number;

  constructor(turn: InternalTurn) {
    this.turn = turn;

    this.initialStartedDateTime = turn.startedDateTime;
    this.turnCount = 1;
    this.totalRequestTimeMs = turn.timeMs;
  }

  addChild(childTurn: InternalTurn): ConvoNode {
    const childNode = new ConvoNode(childTurn);
    childNode.initialStartedDateTime = this.initialStartedDateTime;
    childNode.turnCount = this.turnCount + 1;
    childNode.totalRequestTimeMs = this.totalRequestTimeMs + childTurn.timeMs;

    this.children.push(childNode);
    return childNode;
  }
}

function collateAllInternalTurns(har: Har): InternalTurn[] {
  const internalTurns: InternalTurn[] = [];

  if (!har?.log?.entries) {
    console.error("Invalid HAR file: missing log.entries");
    return [];
  }

  for (const entry of har.log.entries) {
    const postDataText = entry.request.postData?.text;
    const startedDateTime = entry.startedDateTime;
    const timeMs = entry.time;

    if (!postDataText || !startedDateTime) {
      continue;
    }

    let requestContext: LLMContent[] = [];
    try {
      const requestBody: GeminiBody = JSON.parse(postDataText);
      if (Array.isArray(requestBody.contents)) {
        requestContext = requestBody.contents;
      }
    } catch (e) {
      console.warn("Failed to parse request JSON, skipping entry:", e);
      continue;
    }

    const contextKey = JSON.stringify(requestContext);
    const allResponseParts: DataPart[] = [];
    const responseText = entry.response.content?.text;
    const mimeType = entry.response.content?.mimeType;

    if (responseText) {
      if (mimeType === "text/event-stream") {
        const lines = responseText.split("\n");
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("data: ")) {
            const jsonString = trimmedLine.substring(6);
            if (jsonString) {
              try {
                const sseObject: GeminiAPIOutputs = JSON.parse(jsonString);
                const parts = sseObject.candidates?.[0]?.content?.parts;
                if (Array.isArray(parts)) {
                  allResponseParts.push(...parts);
                }
              } catch {
                /* Ignore parse errors */
              }
            }
          }
        }
      } else if (mimeType.startsWith("application/json")) {
        try {
          const content: GeminiAPIOutputs = JSON.parse(responseText);
          const parts = content.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            allResponseParts.push(...parts);
          }
        } catch {
          /* Ignore parse errors */
        }
      }
    }

    internalTurns.push({
      startedDateTime,
      timeMs,
      requestContext,
      responseParts: allResponseParts,
      contextKey,
    });
  }

  return internalTurns;
}

function startsWith(a: LLMContent[], prefix: LLMContent[]): boolean {
  if (a.length < prefix.length) {
    return false;
  }
  try {
    const aPrefix = a.slice(0, prefix.length);
    return JSON.stringify(aPrefix) === JSON.stringify(prefix);
  } catch {
    return false;
  }
}

function collateContexts(har: Har): FinalChainReport[] {
  const allTurns = collateAllInternalTurns(har);

  allTurns.sort((a, b) => a.requestContext.length - b.requestContext.length);

  const roots: ConvoNode[] = [];

  const nodeIndex = new Map<string, ConvoNode>();

  for (const turn of allTurns) {
    let parentNode: ConvoNode | null = null;
    let maxPrefixLength = -1;

    for (const root of roots) {
      const parent = findLongestPrefixNode(root, turn);
      if (parent) {
        if (parent.turn.requestContext.length > maxPrefixLength) {
          maxPrefixLength = parent.turn.requestContext.length;
          parentNode = parent;
        }
      }
    }

    let newNode: ConvoNode;
    if (parentNode) {
      newNode = parentNode.addChild(turn);
    } else {
      newNode = new ConvoNode(turn);
      roots.push(newNode);
    }

    nodeIndex.set(turn.contextKey, newNode);
  }

  const finalReports: FinalChainReport[] = [];
  for (const root of roots) {
    collectLeafReports(root, finalReports);
  }

  finalReports.sort((a, b) => {
    return a.startedDateTime.localeCompare(b.startedDateTime);
  });

  return finalReports;
}

function findLongestPrefixNode(
  node: ConvoNode,
  turn: InternalTurn
): ConvoNode | null {
  let longestPrefix: ConvoNode | null = null;

  if (startsWith(turn.requestContext, node.turn.requestContext)) {
    longestPrefix = node;
  } else {
    return null;
  }

  for (const child of node.children) {
    const longerPrefix = findLongestPrefixNode(child, turn);
    if (longerPrefix) {
      longestPrefix = longerPrefix; // Found a better (longer) one
    }
  }

  return longestPrefix;
}

function collectLeafReports(node: ConvoNode, reports: FinalChainReport[]) {
  if (node.children.length === 0) {
    const finalTurn = node.turn;
    const initialTime = new Date(node.initialStartedDateTime).getTime();
    const finalTime =
      new Date(finalTurn.startedDateTime).getTime() + finalTurn.timeMs;

    let totalThoughts = 0;
    let totalFunctionCalls = 0;

    const context = [
      ...finalTurn.requestContext,
      { parts: finalTurn.responseParts },
    ];

    context
      .flatMap((content) => content?.parts)
      .filter((part) => !!part)
      .forEach((part) => {
        if (part.thought) {
          totalThoughts++;
        } else if ("functionCall" in part) {
          totalFunctionCalls++;
        }
      });

    reports.push({
      type: "context",
      startedDateTime: node.initialStartedDateTime,
      totalDurationMs: finalTime - initialTime,
      turnCount: node.turnCount,
      totalRequestTimeMs: node.totalRequestTimeMs,
      totalThoughts,
      totalFunctionCalls,
      context,
    });
    return;
  }

  for (const child of node.children) {
    collectLeafReports(child, reports);
  }
}
