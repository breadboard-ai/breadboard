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
import { GeminiPrompt } from "./gemini-prompt";
import { ok, toJson } from "@breadboard-ai/utils";
import { GeminiSchema } from "./gemini";
import { llm } from "./utils";
import { StreamableReporter } from "./output";
import {
  isInlineData,
  isTextCapabilityPart,
  isStoredData,
} from "@google-labs/breadboard";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";

export { renderConsistentUI };

const EXAMPLES = [
  "If the content is predominantly visual media (images and videos) then arrange them in a neat grid using Rows, Columns, and Lists. Try to put a few items on each row and try to make sure the grid is balanced. Put any other content, including text and audio, below the media. If there is a title, place it at the top.",
  "If there are two or more pieces of visual media (images and videos) then give them priority and place them in a Row at the top with everything else underneath in a List. If there is a title, place it at the top.",
  "If there is one piece of visual media (image or video), place it to the left, and put everything else to the right in a List. Within the list prioritize audio.If there is a title, place it at the top.",
  "If all else fails and nothing matches the above examples, stack everything up in a vertical List in the order you find them. If there is a title, place it at the top.",
];

const UI_SCHEMA: GeminiSchema = {
  description:
    "Describes a JSON payload for an A2UI message, which is used to dynamically construct and update user interfaces. A message MUST contain a 'surfaceId' and exactly ONE of the action properties: 'beginRendering', 'surfaceUpdate', 'dataModelUpdate', or 'surfaceDeletion'.",
  type: "object",
  properties: {
    surfaceId: {
      type: "string",
      description:
        "The unique identifier for the UI surface this message applies to.",
    },
    beginRendering: {
      type: "object",
      description:
        "Signals the client to begin rendering a surface with a root component and specific styles.",
      properties: {
        root: {
          type: "string",
          description: "The ID of the root component to render.",
        },
        styles: {
          type: "object",
          description: "Styling information for the UI.",
          properties: {
            font: {
              type: "string",
              description: "The primary font for the UI.",
            },
            logoUrl: {
              type: "string",
              description: "A URL for the logo image.",
            },
            primaryColor: {
              type: "string",
              description:
                "The primary UI color as a hexadecimal code (e.g., '#00BFFF').",
            },
          },
        },
      },
      required: ["root"],
    },
    surfaceUpdate: {
      type: "object",
      description: "Updates a surface with a new set of components.",
      properties: {
        components: {
          type: "array",
          description: "A list containing all UI components for the surface.",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "The unique identifier for this component.",
              },
              component: {
                type: "object",
                description:
                  "A wrapper object that MUST contain exactly one key, which is the name of the component type (e.g., 'Heading'). The value is an object containing the properties for that specific component.",
                properties: {
                  Heading: {
                    type: "object",
                    properties: {
                      text: {
                        type: "object",
                        properties: {
                          literal: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                      level: {
                        type: "string",
                        enum: ["1", "2", "3", "4", "5"],
                      },
                    },
                    required: ["text"],
                  },
                  Text: {
                    type: "object",
                    properties: {
                      text: {
                        type: "object",
                        properties: {
                          literal: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                    },
                    required: ["text"],
                  },
                  Image: {
                    type: "object",
                    properties: {
                      url: {
                        type: "object",
                        properties: {
                          literal: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                      fit: {
                        type: "string",
                        enum: [
                          "fill",
                          "cover",
                          "contain",
                          "none",
                          "scale-down",
                        ],
                      },
                    },
                    required: ["url"],
                  },
                  Video: {
                    type: "object",
                    properties: {
                      url: {
                        type: "object",
                        properties: {
                          literal: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                    },
                    required: ["url"],
                  },
                  AudioPlayer: {
                    type: "object",
                    properties: {
                      url: {
                        type: "object",
                        properties: {
                          literal: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                      description: {
                        type: "object",
                        properties: {
                          literal: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                    },
                    required: ["url"],
                  },
                  Row: {
                    type: "object",
                    properties: {
                      children: {
                        type: "object",
                        description:
                          "Defines the children. Use 'explicitList' for a fixed set of children, or 'template' to generate children from a data list.",
                        properties: {
                          explicitList: {
                            type: "array",
                            items: { type: "string" },
                          },
                          template: {
                            type: "object",
                            properties: {
                              componentId: { type: "string" },
                              dataBinding: { type: "string" },
                            },
                            required: ["componentId", "dataBinding"],
                          },
                        },
                      },
                      distribution: {
                        type: "string",
                        enum: [
                          "start",
                          "center",
                          "end",
                          "spaceBetween",
                          "spaceAround",
                          "spaceEvenly",
                        ],
                      },
                      alignment: {
                        type: "string",
                        enum: ["start", "center", "end", "stretch"],
                      },
                    },
                    required: ["children"],
                  },
                  Column: {
                    type: "object",
                    properties: {
                      children: {
                        type: "object",
                        description:
                          "Defines the children. Use 'explicitList' for a fixed set of children, or 'template' to generate children from a data list.",
                        properties: {
                          explicitList: {
                            type: "array",
                            items: { type: "string" },
                          },
                          template: {
                            type: "object",
                            properties: {
                              componentId: { type: "string" },
                              dataBinding: { type: "string" },
                            },
                            required: ["componentId", "dataBinding"],
                          },
                        },
                      },
                      distribution: {
                        type: "string",
                        enum: [
                          "start",
                          "center",
                          "end",
                          "spaceBetween",
                          "spaceAround",
                          "spaceEvenly",
                        ],
                      },
                      alignment: {
                        type: "string",
                        enum: ["start", "center", "end", "stretch"],
                      },
                    },
                    required: ["children"],
                  },
                  List: {
                    type: "object",
                    properties: {
                      children: {
                        type: "object",
                        description:
                          "Defines the children. Use 'explicitList' for a fixed set of children, or 'template' to generate children from a data list.",
                        properties: {
                          explicitList: {
                            type: "array",
                            items: { type: "string" },
                          },
                          template: {
                            type: "object",
                            properties: {
                              componentId: { type: "string" },
                              dataBinding: { type: "string" },
                            },
                            required: ["componentId", "dataBinding"],
                          },
                        },
                      },
                      direction: {
                        type: "string",
                        enum: ["vertical", "horizontal"],
                      },
                      alignment: {
                        type: "string",
                        enum: ["start", "center", "end", "stretch"],
                      },
                    },
                    required: ["children"],
                  },
                  Card: {
                    type: "object",
                    properties: { child: { type: "string" } },
                    required: ["child"],
                  },
                  Tabs: {
                    type: "object",
                    properties: {
                      tabItems: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: {
                              type: "object",
                              properties: {
                                literal: { type: "string" },
                                path: { type: "string" },
                              },
                            },
                            child: { type: "string" },
                          },
                          required: ["title", "child"],
                        },
                      },
                    },
                    required: ["tabItems"],
                  },
                  Divider: {
                    type: "object",
                    properties: {
                      axis: {
                        type: "string",
                        enum: ["horizontal", "vertical"],
                      },
                    },
                  },
                  Modal: {
                    type: "object",
                    properties: {
                      entryPointChild: { type: "string" },
                      contentChild: { type: "string" },
                    },
                    required: ["entryPointChild", "contentChild"],
                  },
                  Button: {
                    type: "object",
                    properties: {
                      label: {
                        type: "object",
                        properties: {
                          literal: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                      action: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          context: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                key: { type: "string" },
                                value: {
                                  type: "object",
                                  properties: {
                                    path: { type: "string" },
                                    literal: { type: "string" },
                                    literalNumber: { type: "number" },
                                    literalBoolean: { type: "boolean" },
                                  },
                                },
                              },
                              required: ["key", "value"],
                            },
                          },
                        },
                        required: ["name"],
                      },
                    },
                    required: ["label", "action"],
                  },
                  CheckBox: {
                    type: "object",
                    properties: {
                      label: {
                        type: "object",
                        properties: {
                          literal: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                      value: {
                        type: "object",
                        properties: {
                          literalBoolean: { type: "boolean" },
                          path: { type: "string" },
                        },
                      },
                    },
                    required: ["label", "value"],
                  },
                  TextField: {
                    type: "object",
                    properties: {
                      label: {
                        type: "object",
                        properties: {
                          literal: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                      text: {
                        type: "object",
                        properties: {
                          literal: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                      textFieldType: {
                        type: "string",
                        enum: ["shortText", "number", "date", "longText"],
                      },
                      validationRegexp: { type: "string" },
                    },
                    required: ["label"],
                  },
                  DateTimeInput: {
                    type: "object",
                    properties: {
                      value: {
                        type: "object",
                        properties: {
                          literalString: { type: "string" },
                          path: { type: "string" },
                        },
                      },
                      enableDate: { type: "boolean" },
                      enableTime: { type: "boolean" },
                      outputFormat: { type: "string" },
                    },
                    required: ["value"],
                  },
                  MultipleChoice: {
                    type: "object",
                    properties: {
                      selections: {
                        type: "object",
                        properties: {
                          literalArray: {
                            type: "array",
                            items: { type: "string" },
                          },
                          path: { type: "string" },
                        },
                      },
                      options: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label: {
                              type: "object",
                              properties: {
                                literal: { type: "string" },
                                path: { type: "string" },
                              },
                            },
                            value: { type: "string" },
                          },
                          required: ["label", "value"],
                        },
                      },
                      maxAllowedSelections: { type: "integer" },
                    },
                    required: ["selections", "options"],
                  },
                  Slider: {
                    type: "object",
                    properties: {
                      value: {
                        type: "object",
                        properties: {
                          literalNumber: { type: "number" },
                          path: { type: "string" },
                        },
                      },
                      minValue: { type: "number" },
                      maxValue: { type: "number" },
                    },
                    required: ["value"],
                  },
                },
              },
            },
            required: ["id", "component"],
          },
        },
      },
      required: ["components"],
    },
    dataModelUpdate: {
      type: "object",
      description: "Updates the data model for a surface.",
      properties: {
        path: {
          type: "string",
          description:
            "An optional path to a location within the data model (e.g., 'user.name'). If omitted, the entire data model will be replaced.",
        },
        contents: {
          type: "array",
          description: "A list of key-value pairs representing the data.",
          items: {
            type: "object",
            description:
              "A single data entry. Exactly one 'value_' property should be provided alongside the key.",
            properties: {
              key: {
                type: "string",
                description: "The key for this data entry.",
              },
              value_string: {
                type: "string",
                description: "A string value.",
              },
              value_number: {
                type: "number",
                description: "A number value.",
              },
              value_boolean: {
                type: "boolean",
                description: "A boolean value.",
              },
            },
            required: ["key"],
          },
        },
      },
      required: ["contents"],
    },
    surfaceDeletion: {
      type: "object",
      description:
        "Signals the client to delete the surface. The object should be empty; its presence is the signal. Only include if the surface is to be deleted.",
      properties: { unused: { type: "string" } },
    },
  },
  required: ["surfaceId"],
};

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

    ULTRA IMPORTANT: You MUST preserve all original paths for media. You must
    also retain any line breaks in literal strings you generate.
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
  moduleArgs: A2ModuleFactoryArgs,
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
          items: UI_SCHEMA,
        },
      },
    },
  });
  const generated = await prompt.invoke();
  if (!ok(generated)) return generated;
  const reporter = new StreamableReporter(caps, {
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

    await reporter.start();
    await reporter.sendA2UI("Generated UI", toJson(generated.all), "download");

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
    await reporter.close();
  }
}
