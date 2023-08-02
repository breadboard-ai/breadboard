/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerateTextRequest, SafetySetting, TextPrompt } from "./types.js";

const safetySetting: SafetySetting = {
  category: "HARM_CATEGORY_UNSPECIFIED",
  threshold: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
};

/**
 * Enum of valid categories in `SafetySetting` object.
 */
export type SafetyCategory = typeof safetySetting.category;
/**
 * Enum of valid thresholds in `SafetySetting` object.
 */
export type SafetyThreshold = typeof safetySetting.threshold;

/**
 * Partial `GenerateTextRequest` object, for use with the `Text` class.
 * It's basically the same as `GenerateTextRequest`, except that `prompt` is optional.
 */
export interface PartialGenerateTextRequest
  extends Omit<GenerateTextRequest, "prompt"> {
  prompt?: TextPrompt;
}

/**
 * A convenience builder for text-like requests.
 *
 * Implements `GenerateTextRequest` interface.
 *
 * Example:
 *
 * ```typescript
 * const text = new Text();
 * text.text("Hello there!");
 * const data = await fetch(palm(PALM_KEY).text(text));
 * const response = await data.json();
 * ```
 */
export class Text implements GenerateTextRequest {
  candidateCount?: number;
  maxOutputTokens?: number;
  prompt: TextPrompt = { text: "" };
  safetySettings?: SafetySetting[];
  stopSequences?: string[];
  temperature?: number;
  topK?: number;
  topP?: number;

  /**
   * Creates a new instance of a `GenerateTextRequest` builder. You can pass this instance directly into `palm().text()`. The builder follows the typical pattern of builder classes, where you can chain methods together to build the request, like so:
   *
   * ```typescript
   * const text = new Text();
   * text
   * .text("Hello there!").
   * .addSafetySetting("HARM_CATEGORY_DEROGATORY", "BLOCK_LOW_AND_ABOVE")
   * .addStopSequence("==");
   * const data = await fetch(palm(PALM_KEY).text(text));
   * const response = await data.json();
   * ```
   * @param request A partial request object. Just put things like `temperature` and `candidateCount` into it and they will be used in the built instance.
   */
  constructor(request?: PartialGenerateTextRequest) {
    Object.assign(this, request);
  }

  /**
   * Helper for setting the `text` property of the prompt.
   * @param text Prompt text
   * @returns The builder instance.
   */
  text(text: string) {
    this.prompt.text = text;
    return this;
  }

  /**
   * Helper for adding a `SafetySetting` to the request.
   * @param category A valid `SafetyCategory` enum value.
   * @param threshold A valid `SafetyThreshold` enum value.
   * @returns The builder instance.
   */
  addSafetySetting(category: SafetyCategory, threshold: SafetyThreshold) {
    if (!this.safetySettings) this.safetySettings = [];
    this.safetySettings.push({ category, threshold });
    return this;
  }

  /**
   * Helper for adding a stop sequence to the request.
   * @param sequence A stop sequence to add to the request.
   * @returns The builder instance.
   */
  addStopSequence(sequence: string) {
    if (!this.stopSequences) this.stopSequences = [];
    this.stopSequences.push(sequence);
    return this;
  }
}
