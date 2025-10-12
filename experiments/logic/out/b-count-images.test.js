/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export default async (invoke, mocks, reporter) => {
  const testCases = [
    {
      name: "No images",
      input: {
        input1: {
          parts: [{ text: "This is a simple text prompt." }],
        },
      },
      expectedOutput: "0",
    },
    {
      name: "One image (inlineData)",
      input: {
        input1: {
          parts: [
            { text: "Here is one image:" },
            {
              inlineData: {
                mimeType: "image/png",
                data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
              },
            },
          ],
        },
      },
      expectedOutput: "1",
    },
    {
      name: "One image (fileData)",
      input: {
        input1: {
          parts: [
            { text: "And another image from a file:" },
            {
              fileData: {
                mimeType: "image/jpeg",
                fileUri: "/vfs/out/test.jpg",
              },
            },
          ],
        },
      },
      expectedOutput: "1",
    },
    {
      name: "Multiple images",
      input: {
        input1: {
          parts: [
            { text: "Look at all these pictures." },
            {
              fileData: {
                mimeType: "image/jpeg",
                fileUri: "/vfs/out/cat.jpg",
              },
            },
            { text: "Here's another one." },
            {
              inlineData: {
                mimeType: "image/gif",
                data: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
              },
            },
            {
              fileData: {
                mimeType: "image/webp",
                fileUri: "/vfs/out/dog.webp",
              },
            },
          ],
        },
      },
      expectedOutput: "3",
    },
    {
      name: "Mixed content types",
      input: {
        input1: {
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: "...",
              },
            },
            {
              fileData: {
                mimeType: "image/svg+xml",
                fileUri: "/vfs/out/chart.svg",
              },
            },
            {
              inlineData: {
                mimeType: "video/mp4",
                data: "...",
              },
            },
            {
              fileData: {
                mimeType: "image/png",
                fileUri: "/vfs/out/logo.png",
              },
            },
          ],
        },
      },
      expectedOutput: "2",
    },
    {
      name: "Empty parts array",
      input: {
        input1: {
          parts: [],
        },
      },
      expectedOutput: "0",
    },
    {
      name: "Input has no parts field",
      input: {
        input1: {
          // No parts property
        },
      },
      expectedOutput: "0",
    },
  ];

  for (const tc of testCases) {
    reporter.progress(`Running test: "${tc.name}"`);
    try {
      const result = await invoke(tc.input);

      if (!result || !result.parts || result.parts.length === 0) {
        reporter.fail(
          `Test "${tc.name}" failed: Program returned no output or no parts in the output.`
        );
        continue;
      }

      const textPart = result.parts.find((part) => "text" in part);

      if (!textPart) {
        reporter.fail(
          `Test "${tc.name}" failed: The output did not contain a text part.`
        );
        continue;
      }

      const actualOutput = textPart.text.trim();

      if (actualOutput !== tc.expectedOutput) {
        reporter.fail(
          `Test "${tc.name}" failed: Expected output to be "${tc.expectedOutput}", but got "${actualOutput}".`
        );
      } else {
        reporter.success(`Test "${tc.name}" passed.`);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : `${e}`;
      reporter.fail(`Test "${tc.name}" failed with an exception: ${err}`);
    }
  }
};