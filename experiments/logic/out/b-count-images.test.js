/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export default async (invoke, mocks, reporter) => {
  /**
   * A helper function to run a single test case.
   * @param {string} name - The name of the test case.
   * @param {import('./index.js').LLMContent | undefined} input1 - The content to pass as `input1`.
   * @param {string} expectedOutput - The expected string output from the program.
   */
  const runTest = async (name, input1, expectedOutput) => {
    reporter.progress(`Running test: "${name}"`);
    try {
      const result = await invoke({
        input1
      });

      if (!result) {
        return reporter.fail(
          `Test "${name}": Expected a result but got nothing.`
        );
      }

      if (!result.parts || !Array.isArray(result.parts)) {
        return reporter.fail(
          `Test "${name}": Expected result.parts to be an array, but it was not.`
        );
      }

      if (result.parts.length !== 1) {
        return reporter.fail(
          `Test "${name}": Expected a single part in the output, but got ${result.parts.length} parts.`
        );
      }

      const part = result.parts[0];
      if (!("text" in part)) {
        return reporter.fail(
          `Test "${name}": Expected the output part to be a TextPart, but it was not.`
        );
      }

      const actualOutput = part.text.trim();
      if (actualOutput !== expectedOutput) {
        return reporter.fail(
          `Test "${name}": Expected output "${expectedOutput}", but got "${actualOutput}"`
        );
      }

      reporter.success(`Test "${name}" passed.`);
    } catch (e) {
      reporter.fail(`Test "${name}": An unexpected error occurred:`, e.message);
    }
  };

  await runTest(
    "should return 0 when there are no parts", {
      role: "user",
      parts: [],
    },
    "0"
  );

  await runTest(
    "should return 0 when there are only text parts", {
      role: "user",
      parts: [{
        text: "This is a test prompt."
      }, {
        text: "It has no images."
      }, ],
    },
    "0"
  );

  await runTest(
    "should count a single InlineData image part", {
      role: "user",
      parts: [{
        text: "Here is one image:"
      }, {
        inlineData: {
          mimeType: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        },
      }, ],
    },
    "1"
  );

  await runTest(
    "should count a single FileData image part", {
      role: "user",
      parts: [{
        text: "Here is one image from a file:"
      }, {
        fileData: {
          mimeType: "image/jpeg",
          fileUri: "/vfs/images/test.jpg",
        },
      }, ],
    },
    "1"
  );

  await runTest(
    "should count multiple mixed image parts", {
      role: "user",
      parts: [{
        text: "Here are three images:"
      }, {
        inlineData: {
          mimeType: "image/gif",
          data: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        },
      }, {
        text: "and two more"
      }, {
        fileData: {
          mimeType: "image/webp",
          fileUri: "/vfs/images/another.webp",
        },
      }, {
        fileData: {
          mimeType: "image/jpeg",
          fileUri: "/vfs/images/final.jpeg",
        },
      }, ],
    },
    "3"
  );

  await runTest(
    "should only count parts with image mime types", {
      role: "user",
      parts: [{
        text: "A mix of files:"
      }, {
        fileData: {
          mimeType: "application/pdf",
          fileUri: "/vfs/docs/document.pdf"
        }
      }, {
        fileData: {
          mimeType: "image/png",
          fileUri: "/vfs/images/pic.png"
        }
      }, {
        inlineData: {
          mimeType: "text/plain",
          data: "dGV4dCBmaWxl"
        }
      }, {
        inlineData: {
          mimeType: "image/svg+xml",
          data: "PHN2Zz48L3N2Zz4=",
        }
      }, {
        fileData: {
          mimeType: "audio/mp3",
          fileUri: "/vfs/audio/song.mp3"
        }
      }, ],
    },
    "2"
  );

  await runTest(
    "should return 0 when input1 is undefined",
    undefined,
    "0"
  );

  await runTest(
    "should return 0 when input1 is provided but has no parts property", {
      role: "user"
    }, // no `parts` key
    "0"
  );
};