/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphTheme,
  LLMContent,
  Outcome,
  GOOGLE_GENAI_API_PREFIX,
} from "@breadboard-ai/types";
import { err, ok, isStoredData } from "@breadboard-ai/utils";
import {
  generatePaletteFromColor,
  generatePaletteFromImage,
} from "../../../theme/index.js";
import { AppTheme } from "../../../ui/types/types.js";
import { isInlineData, transformDataParts } from "../../../data/common.js";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

export { generateImage, persistTheme };

const IMAGE_GENERATOR = "gemini-2.5-flash-image";

function endpointURL(model: string) {
  return `${GOOGLE_GENAI_API_PREFIX}/${encodeURIComponent(model)}:generateContent`;
}

/**
 * Generates a theme image from a prompt using the image generation model.
 *
 * This is a pure utility — all dependencies are injected as params.
 */
async function generateImage(
  contents: LLMContent,
  abortSignal: AbortSignal | undefined,
  controller: AppController,
  services: AppServices
): Promise<Outcome<AppTheme>> {
  const editor = controller.editor.graph.editor;
  if (!editor) {
    return err(`Unable to generate themes: can't edit the graph`);
  }
  if (controller.editor.theme.status !== "idle") {
    return err(
      `Unable to generate a theme: theming is not idle. Current status: "${controller.editor.theme.status}"`
    );
  }
  controller.editor.theme.status = "generating";
  try {
    const response = await services.fetchWithCreds(
      endpointURL(IMAGE_GENERATOR),
      {
        method: "POST",
        body: JSON.stringify({ contents }),
        signal: abortSignal,
      }
    );
    const result = (await response.json()) as {
      candidates: {
        content: LLMContent;
      }[];
    };
    if (!response.ok) {
      console.warn(`Theme generation failed with this error`, result);
      return err(`Unable to generate theme`);
    }
    const content = result.candidates.at(0)?.content;
    if (!content) {
      return err(`No content returned`);
    }

    const [splashScreen] = content.parts.filter(
      (part) => "inlineData" in part || "storedData" in part
    );

    if (!splashScreen) {
      return err("Invalid model response");
    }

    let theme = generatePaletteFromColor("#330072");
    const img = new Image();
    if (isInlineData(splashScreen)) {
      img.src = `data:${splashScreen.inlineData.mimeType};base64,${splashScreen.inlineData.data}`;
    } else {
      img.src = splashScreen.storedData.handle;
      img.crossOrigin = "anonymous";
    }
    const generatedTheme = await generatePaletteFromImage(img);
    if (generatedTheme) {
      theme = generatedTheme;
    }

    return {
      ...theme,
      primaryColor: "",
      secondaryColor: "",
      textColor: "",
      tertiary: "",
      primaryTextColor: "",
      backgroundColor: "",
      splashScreen,
    };
  } catch (e) {
    console.warn(e);
    return err("Invalid color scheme generated");
  } finally {
    controller.editor.theme.status = "idle";
  }
}

/**
 * Persists a splash screen image to Drive and builds a GraphTheme.
 *
 * This is a pure utility — all dependencies are injected via `deps`.
 */
async function persistTheme(
  appTheme: AppTheme,
  controller: AppController,
  services: AppServices
): Promise<Outcome<GraphTheme>> {
  controller.editor.theme.status = "uploading";
  try {
    const { primary, secondary, tertiary, error, neutral, neutralVariant } =
      appTheme;

    const graphTheme: GraphTheme = {
      template: "basic",
      templateAdditionalOptions: {},
      palette: {
        primary,
        secondary,
        tertiary,
        error,
        neutral,
        neutralVariant,
      },
      themeColors: {
        primaryColor: appTheme.primaryColor,
        secondaryColor: appTheme.secondaryColor,
        backgroundColor: appTheme.backgroundColor,
        primaryTextColor: appTheme.primaryTextColor,
        textColor: appTheme.textColor,
      },
    };

    if (appTheme.splashScreen) {
      const editor = controller.editor.graph.editor;
      const urlString = editor?.raw().url;
      if (urlString) {
        const url = new URL(urlString);
        const persisted = await transformDataParts(
          url,
          [{ parts: [appTheme.splashScreen] }],
          "persistent",
          services.googleDriveBoardServer.dataPartTransformer()
        );
        if (ok(persisted)) {
          const splashScreen = persisted[0].parts[0];
          if (isStoredData(splashScreen)) {
            graphTheme.splashScreen = splashScreen;
          } else {
            console.warn("Unable to save splash screen", splashScreen);
          }
        } else {
          console.warn(
            `Failed to persist splash screen: "${persisted.$error}"`
          );
        }
      }
    }
    return graphTheme;
  } finally {
    controller.editor.theme.status = "idle";
  }
}
