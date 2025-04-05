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

async function invoke({ endpoint }: Inputs): Promise<Outcome<Outputs>> {
  const response = await fetch({
    url: endpoint,
    file: "/run/saved",
    stream: "text",
  });
  if (!ok(response)) return response;
  const reading = await read({ path: response.response as FileSystemPath });
  if (!ok(reading)) return reading;
  return { result: reading.data };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          title: "Endpoint URL",
          default: "https://echo.free.beeceptor.com",
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
