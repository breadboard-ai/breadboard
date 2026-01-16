/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { StarterPhraseVendor };

const STARTER_PHRASES: ReadonlyArray<string> = [
  "Brainstorming first step",
  "Analyzing objective",
  "Thinking about the problem",
  "Considering solutions",
  "Predicting next step",
];

class StarterPhraseVendor {
  private count = 0;

  private constructor() {}

  phrase() {
    return STARTER_PHRASES[++this.count % STARTER_PHRASES.length];
  }

  static readonly instance = new StarterPhraseVendor();
}
