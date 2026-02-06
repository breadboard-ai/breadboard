/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  DataPart,
  InlineDataCapabilityPart,
  LLMContent,
  Outcome,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { isStoredData, ok } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { A2UI_SCHEMA } from "./au2ui-schema.js";
import { GeminiPrompt } from "./gemini-prompt.js";
import { createReporter } from "../agent/progress-work-item.js";
import { llm } from "./utils.js";
import { isInlineData, isTextCapabilityPart } from "../../data/common.js";

export { renderConsistentUI, A2UI_SCHEMA as UI_SCHEMA };

const EXAMPLES = [
  "If the content is predominantly visual media (images and videos) then arrange them in a neat grid using Rows, Columns, and Lists. Try to put a few items on each row and try to make sure the grid is balanced. Put any other content, including text and audio, below the media. If there is a title, place it at the top.",
  "If there are two or more pieces of visual media (images and videos) then give them priority and place them in a Row at the top with everything else underneath in a List. If there is a title, place it at the top.",
  "If there is one piece of visual media (image or video), place it to the left, and put everything else to the right in a List. Within the list prioritize audio.If there is a title, place it at the top.",
  "If all else fails and nothing matches the above examples, stack everything up in a vertical List in the order you find them. If there is a title, place it at the top.",
];

const examples = `Here are some example layouts which you can use. Do your best
to match these given the content you're working with: ${EXAMPLES.map(
  (description) => {
    return `- "${description}"\n`;
  }
)}`;

function createFullSystemInstruction(si?: LLMContent) {
  let instructions = examples;

  if (
    si &&
    si.parts.length > 0 &&
    isTextCapabilityPart(si.parts[0]) &&
    si.parts[0].text.trim().length > 0
  ) {
    instructions = `- The user's layout request is: "${si.parts[0].text}"`;
  }

  return llm`You are creating a layout for a User Interface. It will be using a
    format called A2UI which has a distinct schema, which I will provide to you,
    and which you must match.

    The user will be providing information about the UI they would like to
    generate and your job is to create the JSON payloads as a single array.

    The Component Catalog you can use is defined in the surfaceUpdate components
    list.

    ${instructions}

    Please return a valid A2UI Protocol Message object necessary to satisfy the
    user request and build the UI from scratch. If you choose to return multiple
    object you must wrap them in an array, but you must provide the surfaces,
    components and a beginRendering object so that it's clear what needs to be
    rendered.

    Whenever you use a dataBinding you must start paths for child items with no
    other prefixes such as 'item' etc. Keep the path purely related to the data
    structure on which it is bound.

    IMPORTANT: You will be provided data so you MUST use that and never add,
    remove, or alter it in any way. Every part in the provided MUST be
    represented in the output, including text, media, headers, everything.

    ULTRA IMPORTANT: You MUST preserve all original paths for media. You MUST
    retain any line breaks in literal strings you generate because they
    will be rendered as Markdown which is very sensitive to line breaks.
  `.asContent();
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function substituteLiterals(
  data: JsonValue,
  substitutions: Map<
    string,
    InlineDataCapabilityPart | StoredDataCapabilityPart
  >
): JsonValue {
  const clonedData = structuredClone(data);
  const recursiveReplace = (currentValue: JsonValue): void => {
    if (Array.isArray(currentValue)) {
      currentValue.forEach(recursiveReplace);
      return;
    }

    if (typeof currentValue === "object" && currentValue !== null) {
      for (const key in currentValue) {
        if (Object.prototype.hasOwnProperty.call(currentValue, key)) {
          const value = currentValue[key];
          if (
            (key === "literal" ||
              key === "literalString" ||
              key === "value_string") &&
            typeof value === "string"
          ) {
            const part = substitutions.get(value);
            if (part) {
              if (isInlineData(part)) {
                currentValue[key] =
                  `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              } else {
                currentValue[key] = part.storedData.handle;
              }
            }
          } else {
            // Recurse.
            recursiveReplace(value);
          }
        }
      }
    }
  };

  recursiveReplace(clonedData);
  return clonedData;
}

type RemappablePart = InlineDataCapabilityPart | StoredDataCapabilityPart;
function is(type: string, part: DataPart): part is RemappablePart {
  if (isInlineData(part)) {
    return part.inlineData.mimeType.startsWith(type);
  } else if (isStoredData(part)) {
    return part.storedData.mimeType.startsWith(type);
  }

  return false;
}

async function renderConsistentUI(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  data: LLMContent,
  systemInstruction?: LLMContent
): Promise<Outcome<LLMContent[]>> {
  // Swap inline data and stored data for proxy values so that Gemini does
  // not need to account for the data in its planning.
  const remap = new Map<string, RemappablePart>();
  data.parts = data.parts.map((part, idx) => {
    if (is("image", part)) {
      const fakeUrl = `img-${idx}.jpg`;
      remap.set(fakeUrl, part);
      return {
        text: `<img src="${fakeUrl}">`,
      };
    } else if (is("audio", part)) {
      const fakeUrl = `audio-${idx}.wav`;
      remap.set(fakeUrl, part);
      return {
        text: `<audio src="${fakeUrl}">`,
      };
    } else if (is("video", part)) {
      const fakeUrl = `video-${idx}.mp4`;
      remap.set(fakeUrl, part);
      return {
        text: `<video src="${fakeUrl}">`,
      };
    }

    return part;
  });

  const prompt = new GeminiPrompt(caps, moduleArgs, {
    model: "gemini-2.5-flash",
    body: {
      contents: [data],
      systemInstruction: createFullSystemInstruction(systemInstruction),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: A2UI_SCHEMA,
        },
      },
    },
  });
  const generated = await prompt.invoke();
  if (!ok(generated)) return generated;
  const reporter = createReporter(moduleArgs, {
    title: "A2UI",
    icon: "web",
  });
  try {
    // Remap any proxy values back to the original data that was passed through.
    for (const val of generated.all) {
      for (const part of val.parts) {
        if ("json" in part && part.json && typeof part.json === "object") {
          part.json = substituteLiterals(part.json, remap);
        }
      }
    }

    // Extract A2UI messages from generated.all (LLMContent[])
    // Each json part contains the messages - Gemini may return full array in one part
    const messages: unknown[] = [];
    for (const content of generated.all) {
      for (const part of content.parts) {
        if ("json" in part) {
          const json = part.json;
          if (Array.isArray(json)) {
            messages.push(...json);
          } else {
            messages.push(json);
          }
        }
      }
    }
    reporter.addA2UI(messages);

    const textEncoder = new TextEncoder();
    const bytes = textEncoder.encode(JSON.stringify(generated.all));

    let byteString = "";
    bytes.forEach((byte) => (byteString += String.fromCharCode(byte)));

    const data = btoa(byteString);
    return [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data,
              mimeType: "text/a2ui",
            },
          },
        ],
      },
    ];
  } finally {
    reporter.finish();
  }
}
