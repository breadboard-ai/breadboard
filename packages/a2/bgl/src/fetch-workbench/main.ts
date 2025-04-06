/**
 * @fileoverview Add a description for your module here.
 */

import fetch from "@fetch";
import read from "@read";
import output from "@output";

import { ok } from "./a2/utils";
import { report } from "./a2/output";

export { invoke as default, describe };

type Inputs = {
  endpoint: string;
};

type Outputs = {
  result: unknown;
};

async function invoke({ endpoint }: Inputs): Promise<Outcome<Outputs>> {
  const response = await fetch({
    url: endpoint,
    file: "/run/saved",
    stream: "sse",
  });
  if (!ok(response)) return response;
  for (;;) {
    const reading = await read({ path: response.response as FileSystemPath });
    console.log("READING", reading);
    if (!ok(reading)) return reading;
    if ("done" in reading && reading.done) {
      return { result: "done" };
    }
    await report({
      actor: "Fetch",
      category: "Streaming",
      name: "Streaming OMG",
      details: reading.data?.at(-1) || "none",
    });
  }
  return { result: "done" };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          title: "Endpoint URL",
          default: "https://sse.dev/test",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        result: {
          type: "object",
          title: "Result",
        },
      },
    } satisfies Schema,
  };
}
