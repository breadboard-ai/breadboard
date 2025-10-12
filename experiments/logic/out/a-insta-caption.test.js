/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export default async (invoke, mocks, reporter) => {
  // 1. Set up the test case.
  reporter.progress("Setting up the test case...");

  // We'll provide two mock images as input.
  const mockImage1 = {
    fileData: {
      fileUri: "/vfs/testing/image_one.jpg",
      mimeType: "image/jpeg",
    },
  };
  const mockImage2 = {
    fileData: {
      fileUri: "/vfs/testing/image_two.png",
      mimeType: "image/png",
    },
  };

  const input = {
    parts: [mockImage1, mockImage2],
  };

  // We expect the program to call the Gemini API once for each image,
  // and we'll provide a mock caption for each call.
  const expectedCaption1 = "A beautiful day by the sea.";
  const expectedCaption2 = "City nights and bright lights.";

  const expectedLLMCalls = [{
    image: mockImage1,
    response: {
      candidates: [{
        content: {
          parts: [{
            text: expectedCaption1
          }]
        },
      }, ],
    },
  }, {
    image: mockImage2,
    response: {
      candidates: [{
        content: {
          parts: [{
            text: expectedCaption2
          }]
        },
      }, ],
    },
  }, ];

  let callCount = 0;

  // 2. Mock the `generateContent` capability.
  mocks.generate.onGenerateContent(async (args) => {
    reporter.progress(`Intercepted call to generateContent #${callCount + 1}`);

    if (callCount >= expectedLLMCalls.length) {
      reporter.fail(
        `Unexpected call to generateContent. Expected ${expectedLLMCalls.length} calls, but received more.`
      );
      // Return a valid but empty response to prevent a crash.
      return {
        candidates: []
      };
    }

    const expectedCall = expectedLLMCalls[callCount];
    const lastContentItem = args.contents[args.contents.length - 1];

    // Verify that the prompt contains a text part asking for a caption.
    const textPart = lastContentItem.parts.find((p) => "text" in p);
    if (!textPart) {
      reporter.fail(`Call #${callCount + 1}: Expected a text part in the prompt.`);
    } else {
      const lowerCaseText = textPart.text.toLowerCase();
      if (!lowerCaseText.includes("caption") ||
        !lowerCaseText.includes("instagram")
      ) {
        reporter.fail(
          `Call #${
            callCount + 1
          }: Prompt text does not seem to ask for an Instagram caption. Received: "${
            textPart.text
          }"`
        );
      } else {
        reporter.success(
          `Call #${callCount + 1}: Prompt text validation passed.`
        );
      }
    }

    // Verify that the prompt contains the correct image.
    const imagePart = lastContentItem.parts.find((p) => "fileData" in p);
    if (!imagePart) {
      reporter.fail(`Call #${callCount + 1}: Expected an image part in the prompt.`);
    } else if (
      imagePart.fileData.fileUri !== expectedCall.image.fileData.fileUri
    ) {
      reporter.fail(
        `Call #${
          callCount + 1
        }: The prompt contained the wrong image. Expected ${
          expectedCall.image.fileData.fileUri
        }, but got ${imagePart.fileData.fileUri}.`
      );
    } else {
      reporter.success(`Call #${callCount + 1}: Image part validation passed.`);
    }

    // Return the predefined response for this call.
    callCount++;
    return expectedCall.response;
  });

  // 3. Invoke the program under test.
  reporter.progress("Invoking the program with two mock images.");
  const result = await invoke(input);

  // 4. Assert the results.
  reporter.progress("Validating the final output...");

  // Check if the correct number of LLM calls were made.
  if (callCount !== expectedLLMCalls.length) {
    return reporter.fail(
      `Expected ${expectedLLMCalls.length} calls to the Gemini API, but ${callCount} were made.`
    );
  }
  reporter.success(
    `Correct number of Gemini API calls were made: ${callCount}.`
  );

  // Check the structure of the output.
  if (!result || !Array.isArray(result.parts)) {
    return reporter.fail(
      "The program's output is malformed. Expected an object with a 'parts' array."
    );
  }

  // We expect 4 parts: image1, caption1, image2, caption2.
  const expectedPartCount = 4;
  if (result.parts.length !== expectedPartCount) {
    return reporter.fail(
      `Expected ${expectedPartCount} parts in the output, but received ${result.parts.length}.`
    );
  }
  reporter.success(
    `Output contains the correct number of parts (${expectedPartCount}).`
  );

  // Validate each part in the output sequence.
  // Part 1: First Image
  const part1 = result.parts[0];
  if (!part1.fileData || part1.fileData.fileUri !== mockImage1.fileData.fileUri) {
    return reporter.fail(
      `Output part 1 should be the first image (${mockImage1.fileData.fileUri}).`
    );
  }
  reporter.success("Part 1: Correctly contains the first image.");

  // Part 2: First Caption
  const part2 = result.parts[1];
  if (!part2.text || part2.text.trim() !== expectedCaption1) {
    return reporter.fail(
      `Output part 2 should be the first caption. Expected "${expectedCaption1}", but got "${
        part2.text || ""
      }".`
    );
  }
  reporter.success("Part 2: Correctly contains the first caption.");

  // Part 3: Second Image
  const part3 = result.parts[2];
  if (!part3.fileData || part3.fileData.fileUri !== mockImage2.fileData.fileUri) {
    return reporter.fail(
      `Output part 3 should be the second image (${mockImage2.fileData.fileUri}).`
    );
  }
  reporter.success("Part 3: Correctly contains the second image.");

  // Part 4: Second Caption
  const part4 = result.parts[3];
  if (!part4.text || part4.text.trim() !== expectedCaption2) {
    return reporter.fail(
      `Output part 4 should be the second caption. Expected "${expectedCaption2}", but got "${
        part4.text || ""
      }".`
    );
  }
  reporter.success("Part 4: Correctly contains the second caption.");
};