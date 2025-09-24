/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as GULF from "@breadboard-ai/gulf";
import {
  LLMContent,
  RunInputEvent,
  RunNodeEndEvent,
} from "@breadboard-ai/types";
import {
  isLLMContent,
  isStoredData,
  isTextCapabilityPart,
} from "@google-labs/breadboard";

export function toGulfStream(): GULF.Types.StreamHeaderMessage {
  return {
    version: "0.7",
  };
}

export function toGulfOutput(
  output: RunNodeEndEvent
): GULF.Types.UnifiedUpdate {
  const root = globalThis.crypto.randomUUID();
  const components: GULF.Types.ComponentUpdateMessage["components"] = [];
  const outputValues = output.data.outputs;
  for (const [key, outputs] of Object.entries(outputValues)) {
    if (!Array.isArray(outputs)) {
      continue;
    }

    for (const output of outputs) {
      if (!isLLMContent(output) || !output) {
        continue;
      }

      const llmOut = output as LLMContent;
      for (let p = 0; p < llmOut.parts.length; p++) {
        const part = llmOut.parts[p];
        const id = `${root}-${key}-${p}`;

        if (isTextCapabilityPart(part)) {
          components.push({
            id,
            componentProperties: {
              Text: {
                text: {
                  literalString: part.text,
                },
              },
            },
          });
        } else if (isStoredData(part)) {
          if (part.storedData.mimeType.startsWith("image")) {
            components.push({
              id,
              componentProperties: {
                Image: {
                  url: {
                    literalString: part.storedData.handle,
                  },
                },
              },
            });
          } else if (part.storedData.mimeType.startsWith("audio")) {
            components.push({
              id,
              componentProperties: {
                AudioPlayer: {
                  url: {
                    literalString: part.storedData.handle,
                  },
                },
              },
            });
          } else if (part.storedData.mimeType.startsWith("video")) {
            components.push({
              id,
              componentProperties: {
                Video: {
                  url: {
                    literalString: part.storedData.handle,
                  },
                },
              },
            });
          }
        }
      }
    }
  }

  return [
    {
      root,
    },
    {
      components: [
        {
          id: root,
          componentProperties: {
            List: {
              direction: "vertical",
              children: {
                explicitList: [...components.map((c) => c.id)],
              },
              alignment: "center",
            },
          },
        },
        ...components,
      ],
    },
  ];
}

export function toGulfInput(input: RunInputEvent): GULF.Types.UnifiedUpdate {
  const root = globalThis.crypto.randomUUID();
  const components: GULF.Types.ComponentUpdateMessage["components"] = [];

  for (const schema of Object.values(input.data.inputArguments)) {
    if (
      !schema ||
      typeof schema !== "object" ||
      Array.isArray(schema) ||
      !("properties" in schema)
    ) {
      console.log(schema);
      throw new Error("Unable to convert");
    }

    for (const [id, property] of Object.entries(schema.properties ?? {})) {
      components.push({
        id,
        componentProperties: {
          TextField: {
            label: { literalString: property.title?.toString() ?? "" },
            text: {
              path: `/input/${id}`,
            },
          },
        },
      });
    }
  }

  const data = [];
  const context = [];
  for (const component of components) {
    if (!component.componentProperties.TextField?.text?.path) {
      continue;
    }

    context.push({
      key: component.id,
      value: {
        path: component.componentProperties.TextField.text.path,
      },
    });

    data.push({
      path: "/input",
      contents: {
        [component.id]: "",
      },
    });
  }

  return [
    {
      root,
    },
    {
      components: [
        {
          id: root,
          componentProperties: {
            List: {
              direction: "vertical",
              children: {
                explicitList: [...components.map((c) => c.id), "submit"],
              },
              alignment: "center",
            },
          },
        },
        ...components,
        {
          id: "submit",
          componentProperties: {
            Button: {
              label: {
                literalString: "Submit",
              },
              action: {
                action: "submit",
                context,
              },
            },
          },
        },
      ],
    },
    ...data,
  ];
}
