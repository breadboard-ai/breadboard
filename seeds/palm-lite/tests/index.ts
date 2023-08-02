/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { PalmModelMethod, palm } from "../src/index.js";

test("palm() produces a PaLM instance", (t) => {
  const instance = palm("PALM_KEY");
  t.is(typeof instance.message, "function");
  t.is(typeof instance.text, "function");
  t.is(typeof instance.embedding, "function");
});

test("palm().message() produces a valid Request", async (t) => {
  const request = palm("PALM_KEY").message({
    prompt: {
      messages: [
        {
          content: "Hello there!",
        },
      ],
    },
  });
  t.true(request instanceof Request);
  t.is(request.method, "POST");
  t.is(request.headers.get("Content-Type"), "application/json");
  t.is(
    request.url,
    "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage?key=PALM_KEY"
  );
  const body = await request.json();
  t.deepEqual(body, {
    prompt: {
      messages: [
        {
          content: "Hello there!",
        },
      ],
    },
  });
});

test("palm().text() produces a valid Request", async (t) => {
  const request = palm("PALM_KEY").text({ prompt: { text: "" } });
  t.true(request instanceof Request);
  t.is(request.method, "POST");
  t.is(request.headers.get("Content-Type"), "application/json");
  t.is(
    request.url,
    "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=PALM_KEY"
  );
  const body = await request.json();
  t.deepEqual(body, { prompt: { text: "" } });
});

test("palm().embedding() produces a valid Request", async (t) => {
  const request = palm("PALM_KEY").embedding({ text: "Hello there!" });
  t.true(request instanceof Request);
  t.is(request.method, "POST");
  t.is(request.headers.get("Content-Type"), "application/json");
  t.is(
    request.url,
    "https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText?key=PALM_KEY"
  );
  const body = await request.json();
  t.deepEqual(body, { text: "Hello there!" });
});

test("palm().getModelId() returns the right default model ids", (t) => {
  t.is(
    palm("PALM_KEY").getModelId(PalmModelMethod.GenerateMessage),
    "chat-bison-001"
  );
  t.is(
    palm("PALM_KEY").getModelId(PalmModelMethod.GenerateText),
    "text-bison-001"
  );
  t.is(
    palm("PALM_KEY").getModelId(PalmModelMethod.EmbedText),
    "embedding-gecko-001"
  );
});
