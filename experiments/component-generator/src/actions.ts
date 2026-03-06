/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Actions — async functions that orchestrate API calls and state mutations.
 *
 * These are the "business logic" of the component generator. They read and
 * write signals on {@link appState}, call APIs, and interact with the
 * registry.
 *
 * ## Actions
 *
 * | Action | What it does |
 * |--------|-------------|
 * | {@link generate} | Build prompt → stream response → parse → register components → select |
 * | {@link imagine} | Generate concept image (with optional reference) → auto-generate |
 * | {@link processUploadedFile} | Read a File into base64 → store in `appState.uploadedImage` |
 */

import { appState, type ImageRef } from "./state.js";
import { registry, type GeneratedComponent } from "./core/registry.js";
import { buildSystemPrompt } from "./core/prompt.js";
import { readSSEStream } from "./core/stream.js";
import {
  extractCodeBlock,
  parseGeneration,
  extractProps,
} from "./core/parser.js";
import { toTitleCase, toKebabCase } from "./utils.js";
import { debugLog } from "./debug.js";

export { generate, imagine, processUploadedFile };

/**
 * Generate a React component from a text description.
 *
 * Builds a Gemini prompt (including any reference/concept images),
 * streams the response with real-time thought display, parses the
 * output into components, registers them, and selects the main one.
 *
 * @param description - The user's component description
 */
async function generate(description: string): Promise<void> {
  appState.loading = true;
  appState.thinking = { status: "Generating…", thoughts: "" };
  debugLog.add("request", { separator: "─── new generation ───" });

  const systemPrompt = buildSystemPrompt({
    useLayoutTokens: appState.useLayoutTokens,
  });

  const userParts: Array<Record<string, unknown>> = [];
  const uploaded = appState.uploadedImage;
  const concept = appState.conceptImage;

  // Include uploaded reference image if available.
  if (uploaded) {
    userParts.push({
      inlineData: { mimeType: uploaded.mimeType, data: uploaded.base64 },
    });
  }

  // Include AI-generated concept image if available.
  if (concept) {
    userParts.push({
      inlineData: { mimeType: concept.mimeType, data: concept.base64 },
    });
  }

  const hasImages = userParts.length > 0;
  if (hasImages) {
    const labels: string[] = [];
    if (uploaded) labels.push("a reference image");
    if (concept) labels.push("an AI-generated concept");
    userParts.push({
      text: description
        ? `Here is ${labels.join(" and ")} for the component I want. Use ${labels.length > 1 ? "them" : "it"} as visual inspiration for layout, style, and overall feel.\n\nCreate a React component: ${description}`
        : `Recreate this UI as a React component. Match the layout, colors, typography, and overall feel as closely as possible.`,
    });
  } else {
    userParts.push({ text: `Create a React component: ${description}` });
  }

  const requestBody = {
    model: "gemini-3.1-pro-preview",
    systemInstruction: systemPrompt,
    contents: [{ role: "user", parts: userParts }],
    generationConfig: { temperature: 1 },
  };

  debugLog.add("request", requestBody);

  try {
    const response = await fetch("/api/generate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const err = await response.json();
      debugLog.add("error", err);
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const { thoughts, text } = await readSSEStream(response, (t) => {
      const lastLine = t.split("\n").pop() ?? "";
      appState.thinking = {
        status: `Thinking… ${lastLine.slice(0, 80)}`,
        thoughts: t,
      };
    });
    debugLog.add("response", { thoughts, text });

    const rawCode = extractCodeBlock(text);
    if (!rawCode) {
      debugLog.add("error", { message: "No code block found", rawText: text });
      throw new Error("No code block found in the model response.");
    }

    const parsed = parseGeneration(rawCode);
    debugLog.add("parsed", {
      components: parsed.components.map((c) => c.name),
      sharedLength: parsed.shared.length,
    });

    const name = toTitleCase(description);
    const tag = toKebabCase(description);
    let mainTag = tag;
    const generationId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (const parsedComp of parsed.components) {
      const compName = toTitleCase(
        parsedComp.name.replace(/([A-Z])/g, " $1").trim()
      );
      const compTag = parsedComp.isMain
        ? tag
        : toKebabCase(parsedComp.name.replace(/([A-Z])/g, "-$1").trim());

      if (parsedComp.isMain) mainTag = compTag;

      const component: GeneratedComponent = {
        name: compName,
        tag: compTag,
        componentName: parsedComp.name,
        description: parsedComp.isMain
          ? description
          : `Sub-component of ${name}`,
        props: (() => {
          const own = extractProps(parsedComp.code);
          if (own.length > 0 || !parsedComp.isMain) return own;
          return extractProps(rawCode);
        })(),
        code: parsedComp.code,
        sharedCode: parsed.shared,
        isMain: parsedComp.isMain,
        timestamp: Date.now(),
        generationId,
      };
      registry.add(component);
    }

    if (parsed.components.length === 0) {
      registry.add({
        name,
        tag,
        componentName: "Component",
        description,
        props: [],
        code: rawCode,
        sharedCode: "",
        isMain: true,
        timestamp: Date.now(),
        generationId,
      });
      mainTag = tag;
    }

    debugLog.add("render", {
      mainComponent: mainTag,
      allComponents: parsed.components.map((c) => c.name),
    });

    appState.selectedTag = mainTag;
  } catch (err) {
    console.error("Generation failed:", err);
    debugLog.add("error", {
      message: (err as Error).message,
      stack: (err as Error).stack,
    });
    alert(`Generation failed: ${(err as Error).message}`);
  } finally {
    appState.loading = false;
    appState.thinking = null;

    // Reset image state.
    appState.uploadedImage = null;
    appState.conceptImage = null;
  }
}

/**
 * Generate an AI concept image and then run component generation.
 *
 * If the user has uploaded a reference image, it's included in the
 * concept image request so the AI concept is influenced by the user's
 * style reference. Both images are then sent to the generation call.
 *
 * @param description - The user's component description
 */
async function imagine(description: string): Promise<void> {
  appState.imagineLoading = true;
  try {
    const uploaded = appState.uploadedImage;
    const body: Record<string, unknown> = { prompt: description };

    // Include the uploaded reference image so the concept is influenced by it.
    if (uploaded) {
      body.referenceImage = {
        base64: uploaded.base64,
        mimeType: uploaded.mimeType,
      };
    }

    const res = await fetch("/api/concept-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const { base64, mimeType } = await res.json();
    appState.conceptImage = { base64, mimeType };

    debugLog.add("request", {
      separator: "─── imagine ───",
      prompt: description,
      hasReferenceImage: !!uploaded,
    });
  } catch (err) {
    console.error("Concept image failed:", err);
    alert(`Concept image generation failed: ${(err as Error).message}`);
    appState.imagineLoading = false;
    return;
  }
  appState.imagineLoading = false;

  await generate(description);
}

/**
 * Process an uploaded reference image file.
 *
 * Reads the file into base64 and stores it in `appState.uploadedImage`.
 * Returns a promise that resolves with the ImageRef once the file is read.
 *
 * @param file - The uploaded File object
 * @returns The processed image reference
 */
function processUploadedFile(file: File): Promise<ImageRef> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const ref: ImageRef = {
        base64: dataUrl.split(",")[1],
        mimeType: file.type,
      };
      appState.uploadedImage = ref;
      resolve(ref);
    };
    reader.readAsDataURL(file);
  });
}
