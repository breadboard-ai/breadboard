/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppScreenOutput, LLMContent } from "@breadboard-ai/types";
import * as A2UI from "../../../../a2ui/index.js";
import {
  isFileDataCapabilityPart,
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  isStoredData,
  isTextCapabilityPart,
} from "../../../../data/common.js";

function base64toUTF8(str: string) {
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const decoder = new TextDecoder("utf-8");
  return decoder.decode(bytes);
}

type ConvertedLLMContent = {
  ids: string[];
  parts: A2UI.v0_8.Types.ComponentInstance[];
};

function create(component: A2UI.v0_8.Types.ComponentProperties) {
  return {
    id: globalThis.crypto.randomUUID(),
    component,
  } satisfies A2UI.v0_8.Types.ComponentInstance;
}

function createTopLevelComponent(
  component: A2UI.v0_8.Types.ComponentProperties,
  target: ConvertedLLMContent
) {
  const converted = create(component);
  target.ids.push(converted.id);
  target.parts.push(converted);
}

function createMediaComponent(
  type:
    | "Image"
    | "a2ui-custom-video"
    | "AudioPlayer"
    | "a2ui-custom-pdf-viewer",
  url: string,
  target: ConvertedLLMContent
) {
  const media = create({
    [type]: {
      url: { literalString: url },
    },
  });

  // Parent the media to the card.
  const card = create({
    "a2ui-custom-media-container": {
      child: media.id,
    },
  });

  // Add both the media & card to the components list, but only register the
  // card as the top-level item
  target.parts.push(media);
  target.parts.push(card);
  target.ids.push(card.id);
}

function createComponent(
  item: LLMContent,
  setTextAsH1 = false
): ConvertedLLMContent {
  const components: ConvertedLLMContent = {
    ids: [],
    parts: [],
  };

  for (const part of item.parts) {
    if (isTextCapabilityPart(part)) {
      let text = part.text.trim();
      if (text === "") continue;
      if (setTextAsH1) text = `# ${text}`;

      createTopLevelComponent(
        {
          Text: {
            text: { literalString: text },
            usageHint: setTextAsH1 ? "h1" : null,
          },
        },
        components
      );
    } else if (isFileDataCapabilityPart(part)) {
      if (part.fileData.mimeType === "video/mp4") {
        createTopLevelComponent(
          {
            "a2ui-custom-video": {
              fileUri: { literalString: part.fileData.fileUri },
            },
          },
          components
        );
      }
    } else if (isStoredData(part)) {
      if (part.storedData.handle.startsWith("drive:/")) {
        createTopLevelComponent(
          {
            "a2ui-custom-google-drive": {
              fileUri: { literalString: part.storedData.handle },
              resourceKey: { literalString: part.storedData.resourceKey },
            },
          },
          components
        );
      } else if (part.storedData.mimeType.startsWith("image")) {
        createMediaComponent("Image", part.storedData.handle, components);
      } else if (part.storedData.mimeType.startsWith("video")) {
        createMediaComponent(
          "a2ui-custom-video",
          part.storedData.handle,
          components
        );
      } else if (part.storedData.mimeType.startsWith("audio")) {
        createMediaComponent("AudioPlayer", part.storedData.handle, components);
      } else if (part.storedData.mimeType === "application/pdf") {
        createMediaComponent(
          "a2ui-custom-pdf-viewer",
          part.storedData.handle,
          components
        );
      }
    } else if (isInlineData(part)) {
      if (part.inlineData.mimeType === "text/plain") {
        createTopLevelComponent(
          {
            Text: {
              text: { literalString: base64toUTF8(part.inlineData.data) },
            },
          },
          components
        );
      } else {
        const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        if (part.inlineData.mimeType.startsWith("image")) {
          createMediaComponent("Image", url, components);
        } else if (part.inlineData.mimeType.startsWith("video")) {
          createMediaComponent("a2ui-custom-video", url, components);
        } else if (part.inlineData.mimeType.startsWith("audio")) {
          createMediaComponent("AudioPlayer", url, components);
        } else if (part.inlineData.mimeType === "application/pdf") {
          createMediaComponent("a2ui-custom-pdf-viewer", url, components);
        } else {
          createTopLevelComponent(
            {
              Text: {
                text: { literalString: "Unable to render file" },
              },
            },
            components
          );
        }
      }
    }
  }

  return components;
}

export function appScreenToA2UIProcessor(
  appScreenOutput: AppScreenOutput
): A2UI.v0_8.Types.ModelProcessor | null {
  if (!appScreenOutput.output) {
    return null;
  }

  const topLevelIds = [];
  const components = [];
  for (const [name, outputData] of Object.entries(appScreenOutput.output)) {
    const behaviors =
      appScreenOutput.schema?.properties?.[name]?.behavior ?? [];
    const setTextAsH1 = behaviors.includes("hint-chat-mode");

    let toAppend = outputData;
    if (typeof outputData === "string") {
      toAppend = {
        role: "model",
        parts: [{ text: outputData }],
      } satisfies LLMContent;
    }
    if (isLLMContent(toAppend)) {
      const newComponents = createComponent(toAppend, setTextAsH1);
      topLevelIds.push(...newComponents.ids);
      components.push(...newComponents.parts);
    } else if (isLLMContentArray(toAppend)) {
      for (const llmContent of toAppend) {
        const newComponents = createComponent(llmContent, setTextAsH1);
        topLevelIds.push(...newComponents.ids);
        components.push(...newComponents.parts);
      }
    }
  }

  const messages = [
    {
      beginRendering: {
        root: "root",
        surfaceId: "@default",
      },
    },
    {
      surfaceUpdate: {
        surfaceId: "@default",
        components: [
          {
            id: "root",
            weight: 1,
            component: {
              Column: {
                children: { explicitList: topLevelIds },
              },
            },
          },
          ...components,
        ],
      },
    },
  ];

  const processor = A2UI.v0_8.Data.createSignalA2UIModelProcessor();
  processor.clearSurfaces();
  processor.processMessages(messages);

  return processor;
}
