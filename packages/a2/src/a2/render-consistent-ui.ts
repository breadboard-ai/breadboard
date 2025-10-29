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
import { A2ModuleArgs } from "../runnable-module-factory";

export { renderConsistentUI, UI_SCHEMA };

const EXAMPLES = [
  "If the content is predominantly visual media (images and videos) then arrange them in a neat grid using Rows, Columns, and Lists. Try to put a few items on each row and try to make sure the grid is balanced. Put any other content, including text and audio, below the media. If there is a title, place it at the top.",
  "If there are two or more pieces of visual media (images and videos) then give them priority and place them in a Row at the top with everything else underneath in a List. If there is a title, place it at the top.",
  "If there is one piece of visual media (image or video), place it to the left, and put everything else to the right in a List. Within the list prioritize audio.If there is a title, place it at the top.",
  "If all else fails and nothing matches the above examples, stack everything up in a vertical List in the order you find them. If there is a title, place it at the top.",
];

const UI_SCHEMA: GeminiSchema = {
  description:
    "Describes a JSON payload for an A2UI (Agent to UI) message, which is used to dynamically construct and update user interfaces. A message MUST contain exactly ONE of the action properties: 'beginRendering', 'surfaceUpdate', 'dataModelUpdate', or 'deleteSurface'.",
  type: "object",
  properties: {
    beginRendering: {
      type: "object",
      description:
        "Signals the client to begin rendering a surface with a root component and specific styles.",
      properties: {
        surfaceId: {
          type: "string",
          description:
            "The unique identifier for the UI surface to be rendered.",
        },
        root: {
          type: "string",
          description: "The ID of the root component to render.",
        },
      },
      required: ["root", "surfaceId"],
    },
    surfaceUpdate: {
      type: "object",
      description: "Updates a surface with a new set of components.",
      properties: {
        surfaceId: {
          type: "string",
          description:
            "The unique identifier for the UI surface to be updated. If you are adding a new surface this *must* be a new, unique identified that has never been used for any existing surfaces shown.",
        },
        components: {
          type: "array",
          description: "A list containing all UI components for the surface.",
          minItems: 1,
          items: {
            type: "object",
            description:
              "Represents a *single* component in a UI widget tree. This component could be one of many supported types.",
            properties: {
              id: {
                type: "string",
                description: "The unique identifier for this component.",
              },
              weight: {
                type: "number",
                description:
                  "The relative weight of this component within a Row or Column. This corresponds to the CSS 'flex-grow' property. Note: this may ONLY be set when the component is a direct descendant of a Row or Column.",
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
                        description:
                          "The text content for the heading. This can be a literal string or a reference to a value in the data model ('path', e.g. '/doc/title').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
                        },
                      },
                      level: {
                        type: "string",
                        description:
                          "The heading level, corresponding to HTML heading tags (e.g., '1' for <h1>, '2' for <h2>).",
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
                        description:
                          "The text content to display. This can be a literal string or a reference to a value in the data model ('path', e.g. '/hotel/description').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
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
                        description:
                          "The URL of the image to display. This can be a literal string ('literal') or a reference to a value in the data model ('path', e.g. '/thumbnail/url').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
                        },
                      },
                      fit: {
                        type: "string",
                        description:
                          "Specifies how the image should be resized to fit its container. This corresponds to the CSS 'object-fit' property.",
                        enum: [
                          "contain",
                          "cover",
                          "fill",
                          "none",
                          "scale-down",
                        ],
                      },
                    },
                    required: ["url"],
                  },
                  Icon: {
                    type: "object",
                    properties: {
                      name: {
                        type: "object",
                        description:
                          "The name of the icon to display. This can be a literal string ('literal') or a reference to a value in the data model ('path', e.g. '/icon/name').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
                        },
                      },
                    },
                    required: ["name"],
                  },
                  Video: {
                    type: "object",
                    properties: {
                      url: {
                        type: "object",
                        description:
                          "The URL of the video to display. This can be a literal string or a reference to a value in the data model ('path', e.g. '/video/url').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
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
                        description:
                          "The URL of the audio to be played. This can be a literal string ('literal') or a reference to a value in the data model ('path', e.g. '/song/url').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
                        },
                      },
                      description: {
                        type: "object",
                        description:
                          "A description of the audio, such as a title or summary. This can be a literal string or a reference to a value in the data model ('path', e.g. '/song/title').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
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
                            items: {
                              type: "string",
                            },
                          },
                          template: {
                            type: "object",
                            description:
                              "A template for generating a dynamic list of children from a data model list. `componentId` is the component to use as a template, and `dataBinding` is the path to the map of components in the data model. Values in the map will define the list of children.",
                            properties: {
                              componentId: {
                                type: "string",
                              },
                              dataBinding: {
                                type: "string",
                              },
                            },
                            required: ["componentId", "dataBinding"],
                          },
                        },
                      },
                      distribution: {
                        type: "string",
                        description:
                          "Defines the arrangement of children along the main axis (horizontally). This corresponds to the CSS 'justify-content' property.",
                        enum: [
                          "center",
                          "end",
                          "spaceAround",
                          "spaceBetween",
                          "spaceEvenly",
                          "start",
                        ],
                      },
                      alignment: {
                        type: "string",
                        description:
                          "Defines the alignment of children along the cross axis (vertically). This corresponds to the CSS 'align-items' property.",
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
                            items: {
                              type: "string",
                            },
                          },
                          template: {
                            type: "object",
                            description:
                              "A template for generating a dynamic list of children from a data model list. `componentId` is the component to use as a template, and `dataBinding` is the path to the map of components in the data model. Values in the map will define the list of children.",
                            properties: {
                              componentId: {
                                type: "string",
                              },
                              dataBinding: {
                                type: "string",
                              },
                            },
                            required: ["componentId", "dataBinding"],
                          },
                        },
                      },
                      distribution: {
                        type: "string",
                        description:
                          "Defines the arrangement of children along the main axis (vertically). This corresponds to the CSS 'justify-content' property.",
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
                        description:
                          "Defines the alignment of children along the cross axis (horizontally). This corresponds to the CSS 'align-items' property.",
                        enum: ["center", "end", "start", "stretch"],
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
                            items: {
                              type: "string",
                            },
                          },
                          template: {
                            type: "object",
                            description:
                              "A template for generating a dynamic list of children from a data model list. `componentId` is the component to use as a template, and `dataBinding` is the path to the map of components in the data model. Values in the map will define the list of children.",
                            properties: {
                              componentId: {
                                type: "string",
                              },
                              dataBinding: {
                                type: "string",
                              },
                            },
                            required: ["componentId", "dataBinding"],
                          },
                        },
                      },
                      direction: {
                        type: "string",
                        description:
                          "The direction in which the list items are laid out.",
                        enum: ["vertical", "horizontal"],
                      },
                      alignment: {
                        type: "string",
                        description:
                          "Defines the alignment of children along the cross axis.",
                        enum: ["start", "center", "end", "stretch"],
                      },
                    },
                    required: ["children"],
                  },
                  Card: {
                    type: "object",
                    properties: {
                      child: {
                        type: "string",
                        description:
                          "The ID of the component to be rendered inside the card.",
                      },
                    },
                    required: ["child"],
                  },
                  Tabs: {
                    type: "object",
                    properties: {
                      tabItems: {
                        type: "array",
                        description:
                          "An array of objects, where each object defines a tab with a title and a child component.",
                        items: {
                          type: "object",
                          properties: {
                            title: {
                              type: "object",
                              description:
                                "The tab title. Defines the value as either a literal value or a path to data model value (e.g. '/options/title').",
                              properties: {
                                literalString: {
                                  type: "string",
                                },
                                path: {
                                  type: "string",
                                },
                              },
                            },
                            child: {
                              type: "string",
                            },
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
                        description: "The orientation of the divider.",
                        enum: ["horizontal", "vertical"],
                      },
                    },
                  },
                  Modal: {
                    type: "object",
                    properties: {
                      entryPointChild: {
                        type: "string",
                        description:
                          "The ID of the component that opens the modal when interacted with (e.g., a button).",
                      },
                      contentChild: {
                        type: "string",
                        description:
                          "The ID of the component to be displayed inside the modal.",
                      },
                    },
                    required: ["entryPointChild", "contentChild"],
                  },
                  Button: {
                    type: "object",
                    properties: {
                      child: {
                        type: "string",
                        description:
                          "The ID of the component to display in the button, typically a Text component.",
                      },
                      action: {
                        type: "object",
                        description:
                          "The client-side action to be dispatched when the button is clicked. It includes the action's name and an optional context payload.",
                        properties: {
                          name: {
                            type: "string",
                          },
                          context: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                key: {
                                  type: "string",
                                },
                                value: {
                                  type: "object",
                                  description:
                                    "Defines the value to be included in the context as either a literal value or a path to a data model value (e.g. '/user/name').",
                                  properties: {
                                    path: {
                                      type: "string",
                                    },
                                    literalString: {
                                      type: "string",
                                    },
                                    literalNumber: {
                                      type: "number",
                                    },
                                    literalBoolean: {
                                      type: "boolean",
                                    },
                                  },
                                },
                              },
                              required: ["key", "value"],
                            },
                          },
                        },
                        required: ["name", "context"],
                      },
                    },
                    required: ["child", "action"],
                  },
                  CheckBox: {
                    type: "object",
                    properties: {
                      label: {
                        type: "object",
                        description:
                          "The text to display next to the checkbox. Defines the value as either a literal value or a path to data model ('path', e.g. '/option/label').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
                        },
                      },
                      value: {
                        type: "object",
                        description:
                          "The current state of the checkbox (true for checked, false for unchecked). This can be a literal boolean ('literalBoolean') or a reference to a value in the data model ('path', e.g. '/filter/open').",
                        properties: {
                          literalBoolean: {
                            type: "boolean",
                          },
                          path: {
                            type: "string",
                          },
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
                        description:
                          "The text label for the input field. This can be a literal string or a reference to a value in the data model ('path, e.g. '/user/name').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
                        },
                      },
                      text: {
                        type: "object",
                        description:
                          "The value of the text field. This can be a literal string or a reference to a value in the data model ('path', e.g. '/user/name').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
                        },
                      },
                      textFieldType: {
                        type: "string",
                        description: "The type of input field to display.",
                        enum: [
                          "date",
                          "longText",
                          "number",
                          "shortText",
                          "obscured",
                        ],
                      },
                      validationRegexp: {
                        type: "string",
                        description:
                          "A regular expression used for client-side validation of the input.",
                      },
                    },
                    required: ["label"],
                  },
                  DateTimeInput: {
                    type: "object",
                    properties: {
                      value: {
                        type: "object",
                        description:
                          "The selected date and/or time value. This can be a literal string ('literalString') or a reference to a value in the data model ('path', e.g. '/user/dob').",
                        properties: {
                          literalString: {
                            type: "string",
                          },
                          path: {
                            type: "string",
                          },
                        },
                      },
                      enableDate: {
                        type: "boolean",
                        description:
                          "If true, allows the user to select a date.",
                      },
                      enableTime: {
                        type: "boolean",
                        description:
                          "If true, allows the user to select a time.",
                      },
                      outputFormat: {
                        type: "string",
                        description:
                          "The desired format for the output string after a date or time is selected.",
                      },
                    },
                    required: ["value"],
                  },
                  MultipleChoice: {
                    type: "object",
                    properties: {
                      selections: {
                        type: "object",
                        description:
                          "The currently selected values for the component. This can be a literal array of strings or a path to an array in the data model('path', e.g. '/hotel/options').",
                        properties: {
                          literalArray: {
                            type: "array",
                            items: {
                              type: "string",
                            },
                          },
                          path: {
                            type: "string",
                          },
                        },
                      },
                      options: {
                        type: "array",
                        description:
                          "An array of available options for the user to choose from.",
                        items: {
                          type: "object",
                          properties: {
                            label: {
                              type: "object",
                              description:
                                "The text to display for this option. This can be a literal string or a reference to a value in the data model (e.g. '/option/label').",
                              properties: {
                                literalString: {
                                  type: "string",
                                },
                                path: {
                                  type: "string",
                                },
                              },
                            },
                            value: {
                              type: "string",
                              description:
                                "The value to be associated with this option when selected.",
                            },
                          },
                          required: ["label", "value"],
                        },
                      },
                      maxAllowedSelections: {
                        type: "integer",
                        description:
                          "The maximum number of options that the user is allowed to select.",
                      },
                    },
                    required: ["selections", "options"],
                  },
                  Slider: {
                    type: "object",
                    properties: {
                      value: {
                        type: "object",
                        description:
                          "The current value of the slider. This can be a literal number ('literalNumber') or a reference to a value in the data model ('path', e.g. '/restaurant/cost').",
                        properties: {
                          literalNumber: {
                            type: "number",
                          },
                          path: {
                            type: "string",
                          },
                        },
                      },
                      minValue: {
                        type: "number",
                        description: "The minimum value of the slider.",
                      },
                      maxValue: {
                        type: "number",
                        description: "The maximum value of the slider.",
                      },
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
      required: ["surfaceId", "components"],
    },
    dataModelUpdate: {
      type: "object",
      description: "Updates the data model for a surface.",
      properties: {
        surfaceId: {
          type: "string",
          description:
            "The unique identifier for the UI surface this data model update applies to.",
        },
        path: {
          type: "string",
          description:
            "An optional path to a location within the data model (e.g., '/user/name'). If omitted, or set to '/', the entire data model will be replaced.",
        },
        contents: {
          type: "array",
          description:
            "An array of data entries. Each entry must contain a 'key' and exactly one corresponding typed 'value*' property.",
          items: {
            type: "object",
            description:
              "A single data entry. Exactly one 'value*' property should be provided alongside the key.",
            properties: {
              key: {
                type: "string",
                description: "The key for this data entry.",
              },
              valueString: {
                type: "string",
              },
              valueNumber: {
                type: "number",
              },
              valueBoolean: {
                type: "boolean",
              },
              valueMap: {
                description: "Represents a map as an adjacency list.",
                type: "array",
                items: {
                  type: "object",
                  description:
                    "One entry in the map. Exactly one 'value*' property should be provided alongside the key.",
                  properties: {
                    key: {
                      type: "string",
                    },
                    valueString: {
                      type: "string",
                    },
                    valueNumber: {
                      type: "number",
                    },
                    valueBoolean: {
                      type: "boolean",
                    },
                  },
                  required: ["key"],
                },
              },
            },
            required: ["key"],
          },
        },
      },
      required: ["contents", "surfaceId"],
    },
    deleteSurface: {
      type: "object",
      description:
        "Signals the client to delete the surface identified by 'surfaceId'.",
      properties: {
        surfaceId: {
          type: "string",
          description:
            "The unique identifier for the UI surface to be deleted.",
        },
      },
      required: ["surfaceId"],
    },
  },
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
