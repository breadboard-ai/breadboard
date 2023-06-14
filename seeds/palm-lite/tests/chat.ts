/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { Chat } from "../src/chat.js";

test("Constructor argument pass-through works as advertised", (t) => {
  {
    const chat = new Chat({ temperature: 0.5 });
    t.is(chat.temperature, 0.5);
  }
  {
    const chat = new Chat();
    t.is(chat.temperature, undefined);
  }
  {
    const chat = new Chat({});
    t.is(chat.temperature, undefined);
  }
});

test("addMessage() works as advertised", (t) => {
  const chat = new Chat();
  t.deepEqual(chat.prompt, { messages: [] });

  chat.addMessage("Hello there!");
  t.deepEqual(chat.prompt, { messages: [{ content: "Hello there!" }] });

  chat.addMessage("General Kenobi!");
  t.deepEqual(chat.prompt, {
    messages: [{ content: "Hello there!" }, { content: "General Kenobi!" }],
  });

  const returns = chat.addMessage("You are a bold one.");
  t.is(returns, chat);
});

test("addExample() works as advertised", (t) => {
  const chat = new Chat();

  chat.addExample({ input: "What is the meaning of life?", output: "42" });
  t.deepEqual(chat.prompt, {
    examples: [
      {
        input: { content: "What is the meaning of life?" },
        output: { content: "42" },
      },
    ],
    messages: [],
  });
  chat.addExample({
    input: "Pull up! All craft pull up!",
    output: "It's a trap!",
  });
  t.deepEqual(chat.prompt, {
    examples: [
      {
        input: { content: "What is the meaning of life?" },
        output: { content: "42" },
      },
      {
        input: { content: "Pull up! All craft pull up!" },
        output: { content: "It's a trap!" },
      },
    ],
    messages: [],
  });

  const returns = chat.addExample({
    input: "I have a bad feeling about this.",
    output: "I have a very bad feeling about this.",
  });
  t.is(returns, chat);
});

test("context() works as advertised", (t) => {
  const chat = new Chat();

  chat.context("What is the meaning of life?");
  t.deepEqual(chat.prompt, {
    context: "What is the meaning of life?",
    messages: [],
  });
  chat.context("Pull up! All craft pull up!");
  t.deepEqual(chat.prompt, {
    context: "Pull up! All craft pull up!",
    messages: [],
  });

  const returns = chat.context("I have a bad feeling about this.");
  t.is(returns, chat);
});
