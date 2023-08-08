/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import {
  prepareRequest,
  prepareResponse,
} from "../../src/nodes/generate-text.js";

test("prepareRequest throws when there's no PALM_KEY", (t) => {
  t.throws(() => prepareRequest({ text: "foo" }));
});

test("prepareRequest throws when there's no text", (t) => {
  t.throws(() => prepareRequest({ PALM_KEY: "foo" }));
});

test("prepareRequest returns a valid request", async (t) => {
  const request = prepareRequest({
    text: "foo",
    PALM_KEY: "bar",
  });
  t.is(
    request.url,
    "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=bar"
  );
  t.is(request.method, "POST");
  t.is(request.headers.get("Content-Type"), "application/json");
  t.is(await request.text(), JSON.stringify({ prompt: { text: "foo" } }));
});

test("prepareRequest knows how to handle stop sequences", async (t) => {
  const request = prepareRequest({
    text: "foo",
    PALM_KEY: "bar",
    stopSequences: ["baz"],
  });
  t.is(
    request.url,
    "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=bar"
  );
  t.is(request.method, "POST");
  t.is(request.headers.get("Content-Type"), "application/json");
  t.is(
    await request.text(),
    JSON.stringify({
      prompt: { text: "foo" },
      stopSequences: ["baz"],
    })
  );
});

test("prepareRequest knows how to handle safety settings", async (t) => {
  const request = prepareRequest({
    text: "foo",
    PALM_KEY: "bar",
    safetySettings: [
      {
        category: "HARM_CATEGORY_DEROGATORY",
        threshold: "BLOCK_LOW_AND_ABOVE",
      },
    ],
  });
  t.is(
    request.url,
    "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=bar"
  );
  t.is(request.method, "POST");
  t.is(request.headers.get("Content-Type"), "application/json");
  t.is(
    await request.text(),
    JSON.stringify({
      prompt: { text: "foo" },
      safetySettings: [
        {
          category: "HARM_CATEGORY_DEROGATORY",
          threshold: "BLOCK_LOW_AND_ABOVE",
        },
      ],
    })
  );
});

test("prepareResponse returns a valid response", async (t) => {
  const data = new Response(
    JSON.stringify({
      candidates: [{ output: "foo" }],
    })
  );
  const response = await prepareResponse(data);
  t.deepEqual(response, { completion: "foo", candidates: [{ output: "foo" }] });
});

test("prepareResponse returns an error response is blocked", async (t) => {
  const data = new Response(
    JSON.stringify({
      filters: [{ reason: "foo" }],
    })
  );
  const response = await prepareResponse(data);
  t.deepEqual(response, { filters: [{ reason: "foo" }] });
});
