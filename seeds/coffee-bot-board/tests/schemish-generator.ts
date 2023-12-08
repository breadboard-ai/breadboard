/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { ExecutionContext } from "ava";

import { config } from "dotenv";

import { schemishGenerator } from "../src/schemish-generator.js";
import { DebugProbe } from "@google-labs/breadboard";

config();

const noPalmKey = (t: ExecutionContext) => {
  if (process.env.PALM_KEY !== undefined) return false;

  t.log("Test didn't run, needs PALM_KEY to be set to run.");
  t.pass();
  return true;
};

test.skip("schemish-generator end-to-end", async (t) => {
  if (noPalmKey(t)) return;

  const inputs = {
    prologue:
      "You are the ordering agent and your job is to listen to the customer and record their order in a specified format.",
    epilogue: "Begin!\nCustomer: I'd like to order a chai latte",
    schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "The type of order.",
          enum: ["drink", "food"],
        },
        order: {
          type: "string",
          description: "The current order of a customer.",
        },
      },
      required: ["type", "order"],
    },
  };

  const outputs = await schemishGenerator.runOnce(inputs);

  t.deepEqual(outputs, { completion: { type: "drink", order: "chai latte" } });
});

test("schemish-generator valid", async (t) => {
  if (noPalmKey(t)) return;

  const inputs = {
    prologue: "not interesting, since we're replacing the generator",
    epilogue: "same",
    schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "The type of order.",
          enum: ["drink", "food"],
        },
        order: {
          type: "string",
          description: "The current order of a customer.",
        },
      },
      required: ["type", "order"],
    },
  };

  const debugProbe = new DebugProbe();

  debugProbe.replaceNode("generator", (_inputs) => {
    return { completion: '{ "type": "drink", "order": "chai latte"}' };
  });

  const outputs = await schemishGenerator.runOnce(inputs, {
    probe: debugProbe,
  });

  t.like(outputs, { completion: { type: "drink", order: "chai latte" } });
});

test("schemish-generator with unparseable JSON", async (t) => {
  if (noPalmKey(t)) return;

  const inputs = {
    prologue:
      "You are the ordering agent and your job is to listen to the customer and record their order in a specified format.",
    epilogue: "Begin!\nCustomer: I'd like to order a chai latte",
    recover: false,
    schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "The type of order.",
          enum: ["drink", "food"],
        },
      },
      required: ["type"],
    },
  };

  const debugProbe = new DebugProbe();

  let count = 0;

  debugProbe.replaceNode("generator", (_inputs) => {
    count++;
    if (count > 2) return { completion: '{ "type": "drink" }' };
    return { completion: '{ typish: "drink"}' };
  });

  const outputs = await schemishGenerator.runOnce(inputs, {
    probe: debugProbe,
  });

  t.is(count, 1);
  t.like(outputs, {
    $error: {
      kind: "error",
      error: {
        message: "Expected property name or '}' in JSON at position 2 (line 1 column 3)",
        type: "parsing",
      },
    },
  });
});

test("schemish-generator with unparseable JSON and recovery", async (t) => {
  if (noPalmKey(t)) return;

  const inputs = {
    prologue:
      "You are the ordering agent and your job is to listen to the customer and record their order in a specified format.",
    epilogue: "Begin!\nCustomer: I'd like to order a chai latte",
    recover: true,
    schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "The type of order.",
          enum: ["drink", "food"],
        },
      },
      required: ["type"],
    },
  };

  const debugProbe = new DebugProbe();

  let count = 0;

  debugProbe.replaceNode("generator", (_inputs) => {
    count++;
    if (count > 2) return { completion: '{ "type": "drink" }' };
    return { completion: '{ type: "drink"}' };
  });

  const outputs = await schemishGenerator.runOnce(inputs, {
    probe: debugProbe,
  });

  t.is(count, 3);
  t.like(outputs, {
    completion: {
      type: "drink",
    },
  });
});

test("schemish-generator with invalid JSON", async (t) => {
  if (noPalmKey(t)) return;

  const inputs = {
    prologue:
      "You are the ordering agent and your job is to listen to the customer and record their order in a specified format.",
    epilogue: "Begin!\nCustomer: I'd like to order a chai latte",
    recover: false,
    schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "The type of order.",
          enum: ["drink", "food"],
        },
      },
      required: ["type"],
    },
  };

  const debugProbe = new DebugProbe();

  let count = 0;

  debugProbe.replaceNode("generator", (_inputs) => {
    count++;
    if (count > 2) return { completion: '{ "type": "drink" }' };
    return { completion: '{ "type": "automobile"}' };
  });

  const outputs = await schemishGenerator.runOnce(inputs, {
    probe: debugProbe,
  });

  t.is(count, 1);
  t.like(outputs, {
    $error: {
      kind: "error",
      error: {
        message: "data/type must be equal to one of the allowed values",
        type: "validation",
      },
    },
  });
});

test("schemish-generator with invalid JSON and recovery", async (t) => {
  if (noPalmKey(t)) return;

  const inputs = {
    prologue:
      "You are the ordering agent and your job is to listen to the customer and record their order in a specified format.",
    epilogue: "Begin!\nCustomer: I'd like to order a chai latte",
    recover: true,
    schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "The type of order.",
          enum: ["drink", "food"],
        },
      },
      required: ["type"],
    },
  };

  const debugProbe = new DebugProbe();

  let count = 0;

  debugProbe.replaceNode("generator", (_inputs) => {
    count++;
    if (count > 2) return { completion: '{ "type": "drink" }' };
    return { completion: '{ "type": "automobile"}' };
  });

  const outputs = await schemishGenerator.runOnce(inputs, {
    probe: debugProbe,
  });

  t.is(count, 3);
  t.like(outputs, {
    completion: {
      type: "drink",
    },
  });
});
