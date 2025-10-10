/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientCapabilitiesDynamic } from "../types/client-event";
import A2UIProtocolMessage from "../schemas/a2ui-message.json";

export function createImageParsePrompt(
  catalog: ClientCapabilitiesDynamic,
  content: {
    inlineData: {
      mimeType: string;
      data: string;
    };
  }
) {
  if (!catalog) {
    throw new Error("No catalog specified");
  }

  const componentTypes = Object.keys(catalog.components);
  const prompt = {
    role: "user",
    parts: [
      `You are creating a text description for a User Interface. Ultimately this
      description will given to an agent which will use the A2UI Protocol to
      create the UI. I will provide the catalog of UI components to you so that
      you can reference it in your description. You will be provided an image by
      the user which you must describe in detail using plain English such that
      the UI agent will be able to recreate it with A2UI.

      Do not include any information about the specific contents, instead focus
      on the layout of the information. Describe what the broad types and where
      information sits relative to other items, e.g, row of cards. In each card
      there is an image at the top, and a title and description below.

    Here's everything you need:`,

      `The user's layout image is: `,
      content,
      `The Component Catalog you can refer to is: ${componentTypes.join(", ")}`,
    ].map((item) => {
      if (typeof item === "object") {
        return item;
      }

      return { text: item };
    }),
  };

  return prompt;
}

export function createA2UIPrompt(
  catalog: ClientCapabilitiesDynamic,
  imageDescription: string,
  instructions: string
) {
  if (!catalog) {
    throw new Error("No catalog specified");
  }

  const combinedInstructions: string[] = [];
  if (imageDescription !== "") {
    combinedInstructions.push(imageDescription);
  }
  if (instructions !== "") {
    combinedInstructions.push(instructions);
  }

  if (combinedInstructions.length === 0) {
    throw new Error("No instructions provided");
  }

  const prompt = {
    role: "user",
    parts: [
      `You are creating a layout for a User Interface. It will be using a
    format called A2UI which has several distinct schemas, each of which I will
    provide to you. The user will be providing information about the UI they
    would like to generate and your job is to create the JSON payloads as a
    single array. Alternatively the user may provide a reference image and you
    must try to understand it and match it as closely as possible.,

    Here's everything you need:`,

      `The user's layout request is: "${combinedInstructions.join('" and "')}"`,
      `The Component Catalog you can use is: ${JSON.stringify(catalog)}`,
      `The A2UI Protocol Message Schema: "${JSON.stringify(A2UIProtocolMessage)}"`,

      `Please return a valid A2UI Protocol Message object necessary to build the
      satisfy the user request. If you choose to return multiple object you must
      wrap them in an array.`,

      `If no data is provided create some. If there are any URLs you must
    make them absolute and begin with a /. Nothing should ever be loaded from
    a remote source`,
    ].map((text) => {
      return { text };
    }),
  };

  return prompt;
}
