/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { GeminiPrompt } from "./gemini-prompt";
import { ok, toJson } from "@breadboard-ai/utils";
import { GeminiSchema } from "./gemini";
import { llm } from "./utils";
import { StreamableReporter } from "./output";

export { renderConsistentUI };

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

function createFullSystemInstruction(si?: LLMContent) {
  return llm`You are creating a layout for a User Interface. It will be using a
    format called A2UI which has a distinct schema, which I will provide to you,
    and which you must match.

    The user will be providing information about the UI they would like to
    generate and your job is to create the JSON payloads as a single array.
    Alternatively the user may provide a reference image and you must try to
    understand it and match it as closely as possible.

    Here's everything you need:

    - The user's layout request is: "${si ?? "No specific instructions"}".
    - The Component Catalog you can use is defined in the surfaceUpdate
      components list.

    Please return a valid A2UI Protocol Message object necessary to satisfy the
    user request and build the UI from scratch. If you choose to return multiple
    object you must wrap them in an array, but you must provide the surfaces,
    components and a beginRendering object so that it's clear what needs to be
    rendered.

    You will be provided data so you must use that and never add or remove
    anything from it. Everything MUST be represented.
  `.asContent();
}

async function renderConsistentUI(
  caps: Capabilities,
  data: LLMContent,
  systemInstruction?: LLMContent
): Promise<Outcome<LLMContent[]>> {
  const prompt = new GeminiPrompt(caps, {
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
    await reporter.start();
    await reporter.sendA2UI("Generated UI", toJson(generated.all), "download");
    return [llm`See Console`.asContent()];
  } finally {
    await reporter.close();
  }
}
