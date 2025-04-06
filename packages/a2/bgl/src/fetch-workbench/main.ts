/**
 * @fileoverview Add a description for your module here.
 */

import fetch from "@fetch";
import read from "@read";
import output from "@output";

export type NonPromise<T> = T extends Promise<unknown> ? never : T;

function ok<T>(o: Outcome<NonPromise<T>>): o is NonPromise<T> {
  return !(o && typeof o === "object" && "$error" in o);
}
export { invoke as default, describe };

type Inputs = {
  endpoint: string;
};

type Outputs = {
  result: unknown;
};

type ReportInputs = {
  /**
   * The name of the actor providing the report
   */
  actor: string;
  /**
   * The general category of the report
   */
  category: string;
  /**
   * The name of the report
   */
  name: string;
  /**
   * The details of the report
   */
  details: string | LLMContent;
  /**
   * The icon to use
   */
  icon?: string;
};

export { report };

async function report(inputs: ReportInputs): Promise<boolean> {
  const { actor: title, category: description, name, details, icon } = inputs;

  const detailsSchema: Schema =
    typeof details === "string"
      ? {
          title: name,
          type: "string",
          format: "markdown",
        }
      : {
          title: name,
          type: "object",
          behavior: ["llm-content"],
        };

  if (icon) {
    detailsSchema.icon = icon;
  }

  const schema: Schema = {
    type: "object",
    properties: {
      details: detailsSchema,
    },
  };

  const { delivered } = await output({
    $metadata: {
      title,
      description,
      icon,
    },
    schema,
    details,
  });
  return delivered;
}

async function invoke({ endpoint }: Inputs): Promise<Outcome<Outputs>> {
  const response = await fetch({
    url: endpoint,
    file: "/run/saved",
    stream: "text",
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
