/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok } from "./a2/utils";
import read from "@read";
import write from "@write";

export { invoke as default, describe };

type InitializeInput = {
  stage: "initialize";
  id: string;
};

type InitializeOutput = {
  title: string;
  configuration: {};
};

type ReadInput = {
  stage: "read";
  id: string;
  configuration: object;
};

type ReadOutput = {
  schema: Schema;
  values: {
    data: LLMContent[];
  };
};

type WriteInput = {
  stage: "write";
  id: string;
  values: {
    data: LLMContent[];
  };
};

type WriteOutput = {};

type Inputs = {
  context?: { parts?: { json?: InitializeInput | ReadInput | WriteInput }[] }[];
};

type Outputs = {
  context: { parts: { json: InitializeOutput | ReadOutput | WriteOutput }[] }[];
};

function cx(json: InitializeOutput | ReadOutput | WriteOutput): Outputs {
  return { context: [{ parts: [{ json }] }] };
}

async function invoke({ context }: Inputs): Promise<Outcome<Outputs>> {
  const inputs = context?.at(-1)?.parts?.at(0)?.json;
  if (!inputs)
    return err(`Can't configure Local Memory: invalid input structure`);

  if (inputs.stage === "initialize") {
    const writing = await write({
      path: `/local/folio/${inputs.id}`,
      data: [{ parts: [{ text: "" }] }],
    });
    if (!ok(writing)) return writing;
    return cx({ title: "Untitled Local Memory", configuration: {} });
  } else if (inputs.stage === "read") {
    const reading = await read({ path: `/local/folio/${inputs.id}` });
    const data = ok(reading) ? reading.data : [];
    return cx({
      schema: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { type: "object", behavior: ["llm-content"] },
          },
        },
      },
      values: { data },
    });
  } else if (inputs.stage === "write") {
    const writing = await write({
      path: `/local/folio/${inputs.id}`,
      data: inputs.values.data,
    });
    console.log("WRITING", inputs);
    if (!ok(writing)) return writing;
    return cx({});
  }
  return err(`Not sure how to handle inputs: ${JSON.stringify(inputs)}`);
}

async function describe() {
  return {
    title: "Configure Local Memory",
    description:
      "Helps configure a new local memory store or edit configuration of an existing local memory store",
    metadata: {
      tags: ["connector-configure"],
    },
    inputSchema: {
      type: "object",
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
        },
      },
    } satisfies Schema,
  };
}
