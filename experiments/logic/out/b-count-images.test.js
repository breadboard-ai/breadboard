/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export default async (invoke, mocks, reporter) => {
  const {
    progress,
    success,
    fail
  } = reporter;

  /**
   * A helper function to validate the output of the program.
   * It checks if the result is an LLMContent object with a single text part
   * that contains the expected number.
   * @param {import("./types.js").LLMContent} result - The output from the invoke function.
   * @param {number} expectedCount - The expected number of images.
   * @returns {{passed: boolean, message?: string}} - The result of the check.
   */
  const checkOutput = (result, expectedCount) => {
    if (!result || !Array.isArray(result.parts)) {
      return {
        passed: false,
        message: `Expected a result with a 'parts' array, but got ${JSON.stringify(result)}`,
      };
    }

    if (result.parts.length !== 1) {
      return {
        passed: false,
        message: `Expected a single part in the output, but got ${result.parts.length}`,
      };
    }

    const part = result.parts[0];
    if (!("text" in part)) {
      return {
        passed: false,
        message: `Expected the output part to be a TextPart, but it was not.`,
      };
    }

    const actualCount = parseInt(part.text.trim(), 10);
    if (isNaN(actualCount) || actualCount !== expectedCount) {
      return {
        passed: false,
        message: `Expected the count to be ${expectedCount}, but got "${
          part.text ? part.text.trim() : "undefined"
        }"`,
      };
    }

    return {
      passed: true
    };
  };

  const testCases = [{
    name: "Multiple images and text",
    input: {
      parts: [{
        text: "Here are two images:"
      }, {
        inlineData: {
          mimeType: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        },
      }, {
        fileData: {
          fileUri: "/vfs/out/some-image.jpeg",
          mimeType: "image/jpeg",
        },
      }, ],
    },
    expectedCount: 2,
    description: "Correctly counted 2 images from mixed part types.",
  }, {
    name: "No images",
    input: {
      parts: [{
        text: "This input has no images."
      }, {
        functionCall: {
          name: "some_function",
          args: {}
        }
      }],
    },
    expectedCount: 0,
    description: "Correctly counted 0 images.",
  }, {
    name: "A single image",
    input: {
      parts: [{
        fileData: {
          fileUri: "/vfs/out/another-image.gif",
          mimeType: "image/gif",
        },
      }, ],
    },
    expectedCount: 1,
    description: "Correctly counted 1 image.",
  }, {
    name: "Empty input parts array",
    input: {
      parts: []
    },
    expectedCount: 0,
    description: "Correctly handled empty input.",
  }, {
    name: "Non-image file data",
    input: {
      parts: [{
        text: "This one has a PDF and a real image."
      }, {
        fileData: {
          fileUri: "/vfs/out/document.pdf",
          mimeType: "application/pdf",
        },
      }, {
        inlineData: {
          mimeType: "image/webp",
          data: "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=", // 1x1 WebP
        },
      }, ],
    },
    expectedCount: 1,
    description: "Correctly ignored non-image MIME types.",
  }, ];

  for (const [index, testCase] of testCases.entries()) {
    progress(`Test Case ${index + 1}: ${testCase.name}`);
    try {
      // The program being tested shouldn't need any capabilities.
      const result = await invoke(testCase.input, {});
      const check = checkOutput(result, testCase.expectedCount);
      if (check.passed) {
        success(`Test Case ${index + 1} Passed: ${testCase.description}`);
      } else {
        fail(`Test Case ${index + 1} Failed:`, check.message);
        // Stop on first failure.
        return;
      }
    } catch (e) {
      fail(
        `Test Case ${index + 1} Failed: The program threw an unexpected error:`,
        e.message
      );
      // Stop on first failure.
      return;
    }
  }
};