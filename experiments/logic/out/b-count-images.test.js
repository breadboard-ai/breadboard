/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export default async (invoke, mocks, reporter) => {
  const testCases = [
    {
      name: "No parts",
      input: { parts: [] },
      expectedOutput: "0",
    },
    {
      name: "Only text parts",
      input: { parts: [{ text: "This is a prompt with no images." }] },
      expectedOutput: "0",
    },
    {
      name: "One image part",
      input: {
        parts: [{ fileData: { mimeType: "image/jpeg", fileUri: "vfs/1" } }],
      },
      expectedOutput: "1",
    },
    {
      name: "Multiple image parts",
      input: {
        parts: [
          { fileData: { mimeType: "image/png", fileUri: "vfs/1" } },
          { fileData: { mimeType: "image/gif", fileUri: "vfs/2" } },
          { fileData: { mimeType: "image/webp", fileUri: "vfs/3" } },
        ],
      },
      expectedOutput: "3",
    },
    {
      name: "Mixed text and image parts",
      input: {
        parts: [
          { text: "Here is the first image:" },
          { fileData: { mimeType: "image/jpeg", fileUri: "vfs/1" } },
          { text: "And here is the second one:" },
          { fileData: { mimeType: "image/png", fileUri: "vfs/2" } },
        ],
      },
      expectedOutput: "2",
    },
    {
      name: "Mixed file types (images and non-images)",
      input: {
        parts: [
          { fileData: { mimeType: "image/jpeg", fileUri: "vfs/1" } },
          { fileData: { mimeType: "video/mp4", fileUri: "vfs/2" } },
          { fileData: { mimeType: "application/pdf", fileUri: "vfs/3" } },
          { fileData: { mimeType: "image/gif", fileUri: "vfs/4" } },
        ],
      },
      expectedOutput: "2",
    },
    {
      name: "Mime types with different cases",
      input: {
        parts: [
          { fileData: { mimeType: "IMAGE/JPEG", fileUri: "vfs/1" } },
          { fileData: { mimeType: "Image/Png", fileUri: "vfs/2" } },
        ],
      },
      expectedOutput: "2",
    },
    {
      name: "Malformed parts (should be ignored)",
      input: {
        parts: [
          { fileData: { mimeType: "image/jpeg", fileUri: "vfs/1" } },
          { text: "A valid text part" },
          {}, // empty part
          { fileData: {} }, // fileData without mimeType
          { notAValidPart: true },
        ],
      },
      expectedOutput: "1",
    },
  ];

  for (const tc of testCases) {
    reporter.progress(`Running test case: "${tc.name}"`);
    try {
      const result = await invoke({ input1: tc.input });

      if (
        !result ||
        !result.parts ||
        !Array.isArray(result.parts) ||
        result.parts.length === 0
      ) {
        reporter.fail(
          `Test case "${tc.name}" failed: Output is not a valid LLMContent object.`
        );
        continue;
      }

      const textPart = result.parts.find((part) => "text" in part);
      if (!textPart) {
        reporter.fail(
          `Test case "${tc.name}" failed: Output does not contain a text part.`
        );
        continue;
      }

      const outputText = textPart.text.trim();

      if (outputText === tc.expectedOutput) {
        reporter.success(
          `Test case "${tc.name}" passed. Got "${outputText}" as expected.`
        );
      } else {
        reporter.fail(
          `Test case "${tc.name}" failed: Expected "${tc.expectedOutput}", but got "${outputText}".`
        );
      }
    } catch (e) {
      reporter.fail(
        `Test case "${tc.name}" failed with an error: ${e.message}`
      );
    }
  }
};