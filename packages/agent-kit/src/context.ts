/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  anyOf,
  array,
  enumeration,
  intersect,
  object,
  optional,
  toJSONSchema,
  unsafeType,
} from "@breadboard-ai/build";
import type { ConvertBreadboardType } from "@breadboard-ai/build/internal/type-system/type.js";
import { code } from "@google-labs/breadboard";

export const textPartType = object({ text: "string" });
export type TextPart = ConvertBreadboardType<typeof textPartType>;

export const functionCallType = object({
  name: "string",
  args: object({}, "string"),
});
export type FunctionCall = ConvertBreadboardType<typeof functionCallType>;

export const functionCallPartType = object({
  functionCall: functionCallType,
});
export type FunctionCallPart = ConvertBreadboardType<
  typeof functionCallPartType
>;

export const llmContentRoleType = enumeration("user", "model", "tool");
export type LlmContentRole = ConvertBreadboardType<typeof llmContentRoleType>;

export const llmContentType = annotate(
  object({
    role: optional(llmContentRoleType),
    parts: array(anyOf(textPartType, functionCallPartType)),
  }),
  { behavior: ["llm-content"] }
);

export type LlmContent = ConvertBreadboardType<typeof llmContentType>;

export const splitMarkerDataType = object({
  /**
   * There are three types of split markers:
   * - start: the beginning of the split
   * - next: the separator between the split parts
   * - end: the end of the split
   */
  type: enumeration("start", "next", "end"),
  /**
   * Unique identifier for the split.
   */
  id: "string",
});
export type SplitMarkerData = ConvertBreadboardType<typeof splitMarkerDataType>;

/**
 * Provides support for storing multiple parallel contexts within
 * a single context.
 *
 * The split marker allows representing multiple parallel contexts
 * as one sequence by separating them with split markers.
 *
 * The sequence begins with a split marker of type "start",
 * followed by one or more split markers of type "separator",
 * and ends with a split marker of type "end".
 *
 * To allow nesting of split markers, a unique identifier is
 * assigned to all split markers that belong to the same split.
 */
export const splitMetadataType = object({
  type: enumeration("split"),
  data: splitMarkerDataType,
});
export type SplitMetadata = ConvertBreadboardType<typeof splitMetadataType>;

export const looperPlanType = object({
  /**
   * Maximum iterations to make. This can be used to create simple
   * "repeat N times" loops.
   */
  max: optional("number"),
  /**
   * Plan items. Each item represents one trip down the "Loop" output, and
   * at the end of the list, the "Context Out".
   */
  todo: optional(
    array(
      object({
        task: "string",
      })
    )
  ),
  /**
   * The marker that will be used by others to signal completion of the job.
   */
  doneMarker: optional("string"),
  /**
   * Indicator that this job is done.
   */
  done: optional("boolean"),
  /**
   * Whether to append only the last item in the loop to the context or all
   * of them.
   */
  appendLast: optional("boolean"),
  /**
   * Whether to return only last item from the context as the final product
   * or all of them;
   */
  returnLast: optional("boolean"),
  /**
   * The next task.
   */
  next: optional("string"),
});
export type LooperPlan = ConvertBreadboardType<typeof looperPlanType>;

export const looperMetadataType = object({
  type: enumeration("looper"),
  data: looperPlanType,
});
export type LooperMetadata = ConvertBreadboardType<typeof looperMetadataType>;

const metadataBase = object({ role: enumeration("$metadata") });
export const metadataType = anyOf(
  intersect(metadataBase, looperMetadataType),
  intersect(metadataBase, splitMetadataType)
);
export type Metadata = ConvertBreadboardType<typeof metadataType>;

// TODO(aomarks) intersect currently knows it can't handle cases like this and
// throws. It's the case where the two intersected objects both have the same
// property. E.g. {role: "$metadata"} & {role?: "$metadata"} should be
// {role: "$metadata"}.
export const looperProgressType = unsafeType<
  ConvertBreadboardType<typeof looperPlanType> & { next: string }
>(
  (() => {
    const schema = toJSONSchema(looperPlanType);
    const required = (schema.required as string[] | undefined) ?? [];
    if (!required.includes("next")) {
      required.push("next");
      schema.required = required;
    }
    return schema;
  })()
);
export type LooperProgress = ConvertBreadboardType<typeof looperProgressType>;

export const contextType = annotate(anyOf(llmContentType, metadataType), {
  behavior: ["llm-content"],
});
export type Context = ConvertBreadboardType<typeof contextType>;

/**
 * Type helper for wrapping `code` functions.
 * @param f -- code function
 * @returns -- code function
 */
export const fun = <
  In = Record<string, unknown>,
  Out = Record<string, unknown>,
>(
  f: (inputs: In) => Out
) => {
  return f;
};

export const addUserParts = ({
  context,
  toAdd,
}: {
  context: Context | Context[];
  toAdd: LlmContent | string;
}): { context: Context[] } => {
  if (!context) throw new Error("Context is required");
  const existing = Array.isArray(context) ? context : [context];
  const incoming = toAdd;
  if (typeof incoming === "string") {
    return { context: existing };
  }
  if (!incoming.parts) {
    const containsUserRole =
      existing.filter(
        (item) => item.role !== "model" && item.role !== "$metadata"
      ).length > 0;
    if (!containsUserRole) {
      return {
        context: [
          ...existing,
          { role: "user", parts: [{ text: "Do your magic" }] },
        ],
      };
    }
    return { context: existing };
  }
  if (!incoming.role) {
    incoming.role = "user";
  }
  const last = existing[existing.length - 1];
  if (!last) {
    return { context: [incoming] };
  }
  if (last.role !== incoming.role) {
    return { context: [...existing, incoming] };
  } else {
    const result = structuredClone(existing) as LlmContent[];
    const index = result.length - 1;
    result[index].parts.push(...incoming.parts);
    return { context: result };
  }
};

export const userPartsAdder = code(addUserParts);

export const readProgress = ({
  context,
  forkOutputs,
}: {
  context: Context | Context[];
  forkOutputs: boolean;
}): {
  progress: LooperProgress[];
  context: Context[];
} => {
  const fork = forkOutputs;
  const existing = Array.isArray(context) ? context : [context];
  const progress: LooperPlan[] = [];
  // Collect all metadata entries in the context.
  // Gives us where we've been and where we're going.
  for (let i = existing.length - 1; i >= 0; i--) {
    const item = existing[i];
    if (item.role === "$metadata" && item.type === "looper") {
      progress.push(item.data);
    }
  }
  // TODO(aomarks) Casts required until code() supports polymorphism better.
  type TempUnsafeResult = {
    progress: LooperProgress[];
    context: Context[];
  };
  if (fork) {
    if (progress.length) {
      return { progress } as TempUnsafeResult;
    } else {
      return { context } as TempUnsafeResult;
    }
  } else {
    return { context, progress } as TempUnsafeResult;
  }
};

export const progressReader = code(readProgress);

export const looperTaskAdderFn = ({
  context,
  progress,
}: {
  context: Context[];
  progress: LooperProgress[];
}): { context: Context[] } => {
  const contents = Array.isArray(context) ? context : [context];
  const plans = Array.isArray(progress) ? progress : [progress];
  const last = plans[0];
  if (!last || !last.next) {
    return { context };
  }
  // @ts-expect-error -- TS doesn't know findLastIndex exists
  const lastLooperMarker = contents.findLastIndex(
    (item: Context) => item.role === "$metadata" && item.type === "looper"
  );
  if (lastLooperMarker >= 0) {
    const pastLooper = contents.slice(lastLooperMarker);
    const hasModel = pastLooper.some((item) => item.role === "model");
    if (hasModel) {
      return { context: contents };
    }
  }
  contents.push({ role: "user", parts: [{ text: last.next }] });
  return { context: contents };
};
export const looperTaskAdder = code(looperTaskAdderFn);

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
    if (item.role === "$metadata" && item.type === "looper") {
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

  const metadata: Metadata = {
    role: "$metadata",
    type: "looper",
    data: {
      done: true,
    },
  };
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
    if (item.role === "$metadata" && item.type === "looper") {
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

/**
 * Given a context, adds a metadata block that contains the
 * split start marker.
 */
export const splitStartAdderFunction = ({
  context,
}: {
  context: Context[];
}): { id: string; context: Context[] } => {
  if (!context) throw new Error("Context is required");
  const c = context;
  const id = Math.random().toString(36).substring(7);
  const metadata: Metadata = {
    role: "$metadata",
    type: "split",
    data: {
      type: "start",
      id,
    },
  };
  return { context: [...c, metadata], id };
};

export const splitStartAdder = code(splitStartAdderFunction);

export type SplitScanResult = [id: string, index: number];

/**
 * Given a bunch of contexts, combines them all into one.
 * A couple of scenarios are supported:
 * - "The single split start context". Happens when Specialist invokes one
 * or more tools, but the tools don't emit any open split markers.
 * In this situation, the first context ("context-0") will have a start marker,
 * with no other context containing any open markers.
 * - "First context as a preamble". Happens when Specialist invokes one or more
 * tools, and all tools consume this context. In this situation, the first
 * context ("context-0") will end at the split start marker, and all other
 * context will contain this context as a preamble, followed by their own
 * generated context.
 * - "Ad hoc". Happens when Joiner is used to combine multiple
 * contexts. In this situation, there are multiple open
 * markers, but no matching preamble in the first context.
 * - "Simple". Happens when Joiner combines multiple context with no open
 * split markers.
 *
 * Strategies for each scenario:
 * - "Single split start context". Add "next" split marker between each context
 * and an "end" marker at the end.
 * - "First context as a preamble". Slice contexts other than first at the
 * preamble index and concatenate them, adding "next" and "end" markers.
 * - "Ad hoc". Concatenate all contexts as-is, no markers.
 * - "Simple". Concatenate all contexts as-is, adding "start", "next" and "end"
 * markers.
 */
export const combineContextsFunction = fun(
  ({ merge, ...inputs }): { context: Context[] } => {
    const entries = Object.entries(inputs).sort() as [string, Context[]][];
    if (merge) {
      const context: Context[] = [];
      const parts: LlmContent["parts"] = [];
      for (const [, input] of entries) {
        const c = asContextArray(input);
        let lastIndex = c.length - 1;
        let last;
        do {
          last = c[lastIndex--];
        } while (lastIndex >= 0 && last.role === "$metadata");
        if (last) {
          parts.push(...(last as LlmContent).parts);
        }
      }
      context.push({ parts, role: "user" });
      return { context };
    } else {
      let mode: "single" | "preamble" | "adhoc" | "simple";
      const [f, ...rest] = entries;
      if (!f) {
        return { context: [] };
      }
      const first = asContextArray(f[1]);
      const firstOpenSplits = scanForSplits(first);
      const preambleIndices: number[] = [];
      for (const [, input] of rest) {
        const c = asContextArray(input);
        const hasOpenSplits = scanForSplits(c);
        if (hasOpenSplits) {
          preambleIndices.push(hasOpenSplits[1]);
        }
      }
      if (!firstOpenSplits) {
        if (preambleIndices.length === 0) {
          mode = "simple";
        } else {
          mode = "adhoc";
        }
      } else {
        const preamblesMatch =
          preambleIndices.length > 0 &&
          preambleIndices.every((value) => value === firstOpenSplits[1]);
        if (preamblesMatch) {
          mode = "preamble";
        } else {
          if (firstOpenSplits[1] === first.length - 1) {
            mode = "single";
          } else {
            mode = "adhoc";
          }
        }
      }
      const context: Context[] = [];
      if (mode === "adhoc") {
        for (const [, input] of entries) {
          const c = asContextArray(input);
          context.push(...c);
        }
        return { context };
      } else if (mode === "simple") {
        const splitId = Math.random().toString(36).substring(7);
        context.push({
          role: "$metadata",
          type: "split",
          data: { type: "start", id: splitId },
        });
        for (const [, input] of entries) {
          const c = asContextArray(input);
          context.push(...c);
          context.push({
            role: "$metadata",
            type: "split",
            data: { type: "next", id: splitId },
          });
        }
      } else if (mode === "preamble") {
        const preambleIndex = firstOpenSplits?.[1] || 0;
        const preamble = entries[0][1].slice(0, preambleIndex + 1);
        context.push(...preamble);
        const splitId = (preamble[preamble.length - 1] as SplitMetadata).data
          .id;
        for (const [, input] of entries) {
          let c = asContextArray(input);
          if (preambleIndex >= 0) {
            c = c.slice(preambleIndex + 1);
          }
          if (c.length) {
            context.push(...c);
            context.push({
              role: "$metadata",
              type: "split",
              data: { type: "next", id: splitId },
            });
          }
        }
      } else if (mode === "single") {
        const splitId = (first[first.length - 1] as SplitMetadata).data.id;
        context.push(...first);
        for (const [, input] of rest) {
          const c = asContextArray(input);
          context.push(...c);
          context.push({
            role: "$metadata",
            type: "split",
            data: { type: "next", id: splitId },
          });
        }
      }
      const last = context[context.length - 1] as SplitMetadata;
      last.data.type = "end";
      return { context };
    }

    function asContextArray(input: Context | Context[]): Context[] {
      return Array.isArray(input) ? input : [input];
    }

    function scanForSplits(c: Context[]): SplitScanResult | null {
      const stack: SplitScanResult[] = [];
      for (const [i, item] of c.entries()) {
        if (item.role !== "$metadata") continue;
        if (item.type !== "split") continue;
        if (item.data.type === "start") {
          stack.push([item.data.id, i]);
        }
        if (item.data.type === "end") {
          const [id] = stack.pop() || [];
          if (id !== item.data.id) {
            console.warn(
              "Split integrity error: mismatched split start/end markers. Start:",
              id,
              "End:",
              item.data.id
            );
            return null;
          }
        }
      }
      return stack.pop() || null;
    }
  }
);
export const combineContexts = code(combineContextsFunction);

/**
 * Takes a single context and splits it into multiple contexts using the
 * split markers.
 */
export const splitContextsFunction = fun(({ context }) => {
  if (!context) throw new Error("Context is required");
  const c = asContextArray(context);
  const last = c[c.length - 1];
  if (
    last.role !== "$metadata" ||
    last.type !== "split" ||
    last.data.type !== "end"
  ) {
    return { context: c };
  }
  const contexts: Context[][] = [];
  let current: Context[] = [];
  for (const item of c) {
    if (item.role === "$metadata" && item.type === "split") {
      if (item.data.type === "start") {
        current = [];
      } else if (item.data.type === "end") {
        contexts.push(current);
      }
    } else {
      current.push(item);
    }
  }
  const result: Record<string, Context[]> = Object.fromEntries(
    contexts.map((c, i) => [`context-${i}`, c])
  );
  return result;

  function asContextArray(input: unknown): Context[] {
    return Array.isArray(input) ? input : [input];
  }
});
