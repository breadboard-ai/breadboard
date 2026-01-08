/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Note: As of December 2025, Firefox doesn't support Trusted Types.
const feedbackURLPolicy = window.trustedTypes?.createPolicy(
  "opal-feedback-url",
  { createScriptURL: createTrustedFeedbackURLImpl }
);

export const createTrustedFeedbackURL =
  feedbackURLPolicy?.createScriptURL.bind(feedbackURLPolicy) ??
  (createTrustedFeedbackURLImpl as unknown as (_: string) => TrustedScriptURL);

function createTrustedFeedbackURLImpl() {
  return "https://support.google.com/inapp/api.js";
}
