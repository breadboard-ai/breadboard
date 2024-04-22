/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { code } from "@google-labs/breadboard";

export type TextPart = { text: string };

export type FunctionCallPart = {
  functionCall: { name: string; args: Record<string, string> };
};

export type ContextItem = {
  role?: string;
  parts: (TextPart | FunctionCallPart)[];
};

export const userPartsAdder = code(({ context, toAdd }) => {
  const existing = context as ContextItem[];
  if (!existing) throw new Error("Context is required");
  const incoming = toAdd as ContextItem;
  const last = existing[existing.length - 1];
  if (!last) {
    return { context: [toAdd] };
  }
  if (last.role === "model") {
    return { context: [...existing, toAdd] };
  } else {
    const result = structuredClone(existing);
    result[result.length - 1].parts.push(...incoming.parts);
    return { context: result };
  }
});

export const contextBuilder = code(({ context, instruction }) => {
  if (typeof context === "string") {
    // A clever trick. Let's see if this works
    // A user can supply context as either ContextItem[] or as a string.
    // When it's a string, let's just conjure up the proper ContextItem[]
    // from that.
    context = [{ role: "user", parts: [{ text: context }] }];
  }
  const list = (context as unknown[]) || [];
  if (list.length > 0) {
    const last = list[list.length - 1] as ContextItem;
    if (last.role === "user") {
      // A trick: the instruction typically sits in front of the actual task
      // that the user requests. So do just that -- add it at the front of the
      // user part list, rather than at the end.
      last.parts.unshift({ text: instruction as string });
      return { context: list };
    }
  }
  return {
    context: [...list, { role: "user", parts: [{ text: instruction }] }],
  };
});

export const contextAssembler = code(({ context, generated }) => {
  if (!context) throw new Error("Context is required");
  return { context: [...(context as ContextItem[]), generated as ContextItem] };
});
