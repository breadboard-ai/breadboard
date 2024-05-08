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

export type LlmContentRole = "user" | "model" | "tool";

export type LlmContent = {
  role?: LlmContentRole;
  parts: (TextPart | FunctionCallPart)[];
};

export type Metadata = {
  role: "$metadata";
  data: unknown;
};

export type Context = LlmContent | Metadata;

/**
 * Type helper for wrapping `code` functions.
 * @param f -- code function
 * @returns -- code function
 */
export const fun = (
  f: (inputs: Record<string, unknown>) => Record<string, unknown>
) => {
  return f;
};

export const userPartsAdder = code(({ context, toAdd }) => {
  const existing = (
    Array.isArray(context) ? context : [context]
  ) as LlmContent[];
  if (!existing) throw new Error("Context is required");
  const incoming = structuredClone(toAdd) as LlmContent;
  if (!incoming.parts) {
    const containsUserRole =
      existing.filter((item) => item.role === "model").length > 0;
    if (!containsUserRole) {
      return {
        context: [
          ...existing,
          { role: "user", parts: [{ text: "Do your magic" }] },
        ],
      };
    }
    return { context };
  }
  if (!incoming.role) {
    incoming.role = "user";
  }
  const last = existing[existing.length - 1];
  if (!last) {
    return { context: [incoming] };
  }
  if (last.role !== "user") {
    return { context: [...existing, incoming] };
  } else {
    const result = structuredClone(existing);
    const index = result.length - 1;
    result[index].parts.push(...incoming.parts);
    return { context: result };
  }
});

export type LooperPlan = {
  /**
   * Maximum iterations to make. This can be used to create simple
   * "repeat N times" loops.
   */
  max?: number;
  /**
   * Plan items. Each item represents one trip down the "Loop" output, and
   * at the end of the list, the "Context Out".
   */
  todo?: {
    task: string;
  }[];
  /**
   * The marker that will be used by others to signal completion of the job.
   */
  doneMarker?: string;
  /**
   * Indicator that this job is done.
   */
  done?: boolean;
  /**
   * Whether to append only the last item in the loop to the context or all
   * of them.
   */
  appendLast?: boolean;
  /**
   * Whether to return only last item from the context as the final product
   * or all of them;
   */
  returnLast?: boolean;
};

export type LooperProgress = LooperPlan & { next: string };

export const progressReader = code(({ context, forkOutputs }) => {
  const fork = forkOutputs as boolean;
  const existing = (Array.isArray(context) ? context : [context]) as Context[];
  const progress: LooperPlan[] = [];
  // Collect all metadata entries in the context.
  // Gives us where we've been and where we're going.
  for (let i = existing.length - 1; i >= 0; i--) {
    const item = existing[i];
    if (item.role === "$metadata") {
      progress.push(item.data as LooperPlan);
    }
  }
  if (fork) {
    if (progress.length) {
      return { progress };
    } else {
      return { context };
    }
  } else {
    return { context, progress };
  }
});

export const looperTaskAdder = code(({ context, progress }) => {
  const contents = (
    Array.isArray(context) ? context : [context]
  ) as LlmContent[];
  const plans = (
    Array.isArray(progress) ? progress : [progress]
  ) as LooperProgress[];
  const last = plans[0];
  if (!last || !last.next) {
    return { context };
  }
  contents.push({ role: "user", parts: [{ text: last.next }] });
  return { context: contents };
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
    const last = list[list.length - 1] as LlmContent;
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

export const contextBuilderWithoutSystemInstruction = code(({ context }) => {
  if (typeof context === "string") {
    // A clever trick. Let's see if this works
    // A user can supply context as either ContextItem[] or as a string.
    // When it's a string, let's just conjure up the proper ContextItem[]
    // from that.
    context = [{ role: "user", parts: [{ text: context }] }];
  }
  const list = (context as unknown[]) || [];
  return { context: list };
});

export const contextAssembler = code(({ context, generated }) => {
  if (!context) throw new Error("Context is required");
  return { context: [...(context as LlmContent[]), generated as LlmContent] };
});

export const checkAreWeDoneFunction = fun(({ context, generated }) => {
  if (!context) throw new Error("Context is required");
  if (!generated) throw new Error("Generated is required");
  const c = context as Context[];
  const g = generated as LlmContent;
  // are there any doneMakers in the context?
  let doneMarker: string | null = null;
  for (let i = 0; i < c.length; ++i) {
    const item = c[i];
    if (item.role === "$metadata") {
      const plan = item.data as LooperPlan;
      if (plan.doneMarker) {
        doneMarker = plan.doneMarker;
        break;
      }
    }
  }

  if (!doneMarker) {
    return { context: [...c, g] };
  }

  // does generated content contain the markers?
  let containsMarkers = false;
  for (let i = 0; i < g.parts.length; ++i) {
    const part = g.parts[i];
    if ("text" in part && part.text.includes(doneMarker)) {
      containsMarkers = true;
      // remove marker from generated
      part.text = part.text.replaceAll(doneMarker, "").trim();
      break;
    }
  }
  if (!containsMarkers) {
    return { context: [...c, g] };
  }

  const metadata = {
    role: "$metadata",
    data: {
      type: "looper",
      done: true,
    },
  } as Metadata;
  return { context: [...c, g, metadata] };
});

export const checkAreWeDone = code(checkAreWeDoneFunction);

/**
 * Given a context, decides if we should skip our turn when the earlier
 * workers signaled that they are done.
 */
export const skipIfDoneFunction = fun(({ context }) => {
  if (!context) throw new Error("Context is required");
  const c = context as Context[];
  // are there any done:true in the context?
  let done = false;
  for (let i = 0; i < c.length; ++i) {
    const item = c[i];
    if (item.role === "$metadata") {
      const plan = item.data as LooperPlan;
      if (plan.done) {
        done = true;
        break;
      }
    }
  }
  if (done) {
    return { done: context };
  } else {
    return { context };
  }
});

export const skipIfDone = code(skipIfDoneFunction);
