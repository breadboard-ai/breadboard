/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { ExecutionContext } from "ava";

import { config } from "dotenv";

import { schemishGenerator } from "../src/schemish-generator.js";

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
