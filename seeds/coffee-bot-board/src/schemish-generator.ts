/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type NodeValue, Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { Nursery } from "@google-labs/node-nursery";
import { Core } from "@google-labs/core-kit";
import { PaLMKit } from "@google-labs/palm-kit";

import { PromptMaker } from "./template.js";

const BASE = "v2-multi-agent";

const maker = new PromptMaker(BASE);

const board = new Board({
  title: "Schemish Generator",
  description:
    "A wrapper for PaLM API `generateText` to ensure that its output conforms to a given schema. The wrapper utilizes [Schemish](https://glazkov.com/2023/05/06/schemish/), which is a compact JSON dialect that is used express JSON Schemas.",
  version: "0.0.1",
});
const core = board.addKit(Core);
const kit = board.addKit(Starter);
const nursery = board.addKit(Nursery);
const palm = board.addKit(PaLMKit);

// Inputs
const prologue = core.passthrough({ $id: "prologue" });
const epilogue = core.passthrough({ $id: "epilogue" });
const schema = core.passthrough({ $id: "schema" });

function gate({ allow, value }: { allow: boolean; value: NodeValue }) {
  if (allow) return { value };
  return { $error: value };
}

const shouldRecover = kit.runJavascript({
  $id: "shouldRecover",
  code: gate.toString(),
  raw: true,
});

const willRecover = core.passthrough({ $id: "willRecover" });

// Outputs
const $error = board.output({
  $id: "error",
  schema: {
    type: "object",
    properties: {
      $error: {
        type: "object",
        title: "Error",
        description: "The error reported during generation",
      },
    },
  },
});
const $completion = board.output({
  $id: "completion",
  schema: {
    type: "object",
    properties: {
      completion: {
        type: "string",
        title: "Completion",
        description:
          "Generated text that conforms to the specified output schema",
      },
    },
  },
});

// Wire all useful parts of the input.
board
  .input({
    $id: "input",
    schema: {
      type: "object",
      properties: {
        prologue: {
          type: "string",
          title: "Template prologue",
          description:
            "The part of the template that preceeds the place where output schema is mentioned",
        },
        epilogue: {
          type: "string",
          title: "Template epilogue",
          description:
            "The part of the template that follows the place where output schema is mentioned",
        },
        schema: {
          type: "object",
          title: "Output schema",
          description: "The JSON schema object that describes desired output",
        },
        recover: {
          type: "boolean",
          title: "Error recovery",
          description:
            "Whether to try to recover from errors or just report failure",
        },
      },
      required: ["prologue", "epilogue", "schema", "recover"],
      additionalProperties: false,
    },
  })
  .wire("prologue->.", prologue)
  .wire("epilogue->.", epilogue)
  .wire("schema->.", schema)
  .wire("recover->allow.", shouldRecover);

shouldRecover.wire("value->", willRecover).wire("$error->", $error);

willRecover.wire("->", prologue).wire("->", epilogue).wire("->", schema);

const convertToSchemish = nursery
  .schemish({ $id: "schemish" })
  .wire("<-schema", schema);

const validateJson = nursery
  .validateJson({ $id: "validate-json" })
  .wire("<-schema", schema)
  .wire("json->completion", $completion)
  .wire("$error->value", shouldRecover);

const generator = palm
  .generateText({
    $id: "generator",
    stopSequences: ["Tool:", "Customer:", "\n\n"],
    safetySettings: [
      {
        category: "HARM_CATEGORY_DEROGATORY",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
    ],
  })
  .wire("<-PALM_KEY.", kit.secrets({ keys: ["PALM_KEY"] }))
  .wire("completion->json", validateJson)
  .wire("filters->value", shouldRecover);

// Template
kit
  .promptTemplate(await maker.prompt("schemish-generator", "schemishGenerator"))
  .wire("<-prologue", prologue)
  .wire("<-epilogue", epilogue)
  .wire("<-schemish", convertToSchemish)
  .wire("prompt->text", generator);

export const schemishGenerator = board;
