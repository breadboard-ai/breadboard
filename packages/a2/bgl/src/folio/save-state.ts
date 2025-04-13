/**
 * @fileoverview Saves the current state into a foilo.
 */

export { invoke as default, describe };

import { ok, err, mergeTextParts } from "./a2/utils";

import write from "@write";
import read from "@read";

type Inputs = {
  id: string;
  context?: LLMContent[];
  info: unknown;
  method: "canSave" | "save";
  "folio-mode": string;
};

const MODE = ["Append", "Prepend", "Replace"];

type Outputs =
  | {
      context: LLMContent[];
    }
  | {
      canSave: boolean;
    };

function getParts(context?: LLMContent[]): DataPart[] {
  const last = context?.at(-1);
  return last ? last.parts : [];
}

async function invoke({
  id,
  method,
  context,
  info,
  "folio-mode": mode,
}: Inputs): Promise<Outcome<Outputs>> {
  if (!context || context.length === 0) {
    return { context: [] };
  }

  if (method === "save") {
    const path: FileSystemPath = `/local/folio/${id}`;
    if (mode === "Append") {
      const readResult = await read({ path });
      if (!ok(readResult)) return readResult;
      const existing = getParts(readResult.data);
      const incoming = getParts(context);
      const data = [
        { parts: mergeTextParts([...existing, ...incoming], "\n\n") },
      ];
      const writeResult = await write({ path, data });
      if (!ok(writeResult)) return writeResult;
    } else if (mode === "Prepend") {
      const readResult = await read({ path });
      if (!ok(readResult)) return readResult;
      const existing = getParts(readResult.data);
      const incoming = getParts(context);
      const data = [
        { parts: mergeTextParts([...incoming, ...existing], "\n\n") },
      ];
      const writeResult = await write({ path, data });
      if (!ok(writeResult)) return writeResult;
    } else {
      // Replace
      const parts = mergeTextParts(getParts(context), "\n\n");
      const writeResult = await write({ path, data: [{ parts }] });
      if (!ok(writeResult)) return writeResult;
    }
    return { context };
  } else if (method === "canSave") {
    return { canSave: true };
  }
  return err(`Unknown method "${method}"`);
}

async function describe() {
  return {
    description: "Saves the current state into a folio",
    title: "Save Current State",
    metadata: {
      tags: ["connector-save"],
    },

    inputSchema: {
      type: "object",
      properties: {
        "folio-mode": {
          type: "string",
          enum: MODE,
          title: "How to save",
          description:
            "Prepend will save at the front, Append will save at the end, and Replace will overwrite what has been saved",
          default: "Append",
          behavior: ["config", "hint-preview"],
          icon: "summarize",
        },
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context to be saved",
          description: "All content as one multi-line string",
        },
      },
    } satisfies Schema,
    outputSchema: {
      // Returns nothing.
      type: "object",
    } satisfies Schema,
  };
}
