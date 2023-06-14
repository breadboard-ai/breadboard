/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { Text } from "../src/text.js";

test("Constructor argument pass-through works as advertised", (t) => {
  {
    const text = new Text({ temperature: 0.5 });
    t.is(text.temperature, 0.5);
  }
  {
    const text = new Text();
    t.is(text.temperature, undefined);
  }
  {
    const text = new Text({});
    t.is(text.temperature, undefined);
  }
});

test("text() works as advertised", (t) => {
  const text = new Text();
  t.deepEqual(text.prompt, { text: "" });

  text.text("Hello there!");
  t.deepEqual(text.prompt, { text: "Hello there!" });

  const returns = text.text("General Kenobi!");
  t.is(returns, text);
});

test("addSafetySetting() works as adversited", (t) => {
  const text = new Text();

  text.addSafetySetting("HARM_CATEGORY_DANGEROUS", "BLOCK_LOW_AND_ABOVE");
  t.deepEqual(text.safetySettings, [
    {
      category: "HARM_CATEGORY_DANGEROUS",
      threshold: "BLOCK_LOW_AND_ABOVE",
    },
  ]);

  text.addSafetySetting("HARM_CATEGORY_MEDICAL", "BLOCK_ONLY_HIGH");
  t.deepEqual(text.safetySettings, [
    {
      category: "HARM_CATEGORY_DANGEROUS",
      threshold: "BLOCK_LOW_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_MEDICAL",
      threshold: "BLOCK_ONLY_HIGH",
    },
  ]);

  const returns = text.addSafetySetting(
    "HARM_CATEGORY_VIOLENCE",
    "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
  );
  t.is(returns, text);
});

test("addStopSequence() works as advertised", (t) => {
  const text = new Text();

  text.addStopSequence("RESPONSE");
  t.deepEqual(text.stopSequences, ["RESPONSE"]);

  text.addStopSequence("==");
  t.deepEqual(text.stopSequences, ["RESPONSE", "=="]);

  const returns = text.addStopSequence("It's a trap!");
  t.is(returns, text);
});
