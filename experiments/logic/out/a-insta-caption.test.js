/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @param {import('./types.js').Invoke} invoke
 * @param {import('./types.js').CapabilityMocks} mocks
 * @param {import('./types.js').TestResultsReporter} reporter
 */
export default async (invoke, mocks, reporter) => {
  // Test Case 1: Multiple Images
  reporter.progress("--- Running Test Case: Multiple Images ---");
  await (async () => {
    // 1. Define mock inputs and expected outputs for this test case.
    const mockImage1 = {
      fileData: {
        fileUri: "/vfs/images/beach.jpg",
        mimeType: "image/jpeg",
      },
    };
    const mockImage2 = {
      fileData: {
        fileUri: "/vfs/images/city.png",
        mimeType: "image/png",
      },
    };
    const mockInput = {
      role: "user",
      parts: [mockImage1, mockImage2],
    };

    const mockCaption1 =
      "Chasing the waves and living on island time. ☀️ #BeachVibes #Sunset";
    const mockCaption2 =
      "City lights and endless nights. ✨ #UrbanExplorer #Cityscape";

    // 2. Set up the mock for the `generateContent` capability.
    reporter.progress(
      "Setting up mock for generateContent to return predefined captions."
    );
    let generateContentCallCount = 0;
    mocks.generate.onGenerateContent(async (args) => {
      generateContentCallCount++;
      reporter.progress(
        `generateContent called (${generateContentCallCount}/2).`
      );

      if (!args.contents || args.contents.length === 0) {
        reporter.fail("generateContent was called without any `contents`.");
        return {
          candidates: [],
        };
      }

      const lastContent = args.contents[args.contents.length - 1];
      const textPart = lastContent.parts.find((p) => "text" in p);
      const imagePart = lastContent.parts.find((p) => "fileData" in p);

      if (!textPart || !imagePart) {
        reporter.fail(
          "Expected generateContent call to contain both a text prompt and an image part."
        );
        return {
          candidates: [],
        };
      }

      const promptText = textPart.text.toLowerCase();
      if (
        !promptText.includes("caption") ||
        !promptText.includes("instagram")
      ) {
        reporter.fail(
          `The prompt to the model seems incorrect. Expected a request for an Instagram caption, but got: "${textPart.text}"`
        );
        return {
          candidates: [],
        };
      }

      // Return the appropriate mock caption based on the image provided.
      let captionText;
      if (imagePart.fileData.fileUri === mockImage1.fileData.fileUri) {
        captionText = mockCaption1;
      } else if (imagePart.fileData.fileUri === mockImage2.fileData.fileUri) {
        captionText = mockCaption2;
      } else {
        reporter.fail(
          `generateContent was called with an unexpected image: ${imagePart.fileData.fileUri}`
        );
        return {
          candidates: [],
        };
      }

      return {
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  text: captionText,
                },
              ],
            },
          },
        ],
      };
    });

    // 3. Invoke the program with the test inputs.
    reporter.progress("Invoking the program with two images.");
    const result = await invoke({
      input1: mockInput,
    });

    // 4. Validate the results.
    reporter.progress("Validating the program's output.");

    if (generateContentCallCount !== 2) {
      return reporter.fail(
        `Expected generateContent to be called 2 times (once per image), but it was called ${generateContentCallCount} times.`
      );
    }
    reporter.success("generateContent was called the correct number of times.");

    if (!result || !Array.isArray(result.parts)) {
      return reporter.fail(
        "The program's output is not valid. Expected an object with a 'parts' array."
      );
    }

    const { parts } = result;
    if (parts.length !== 4) {
      return reporter.fail(
        `Expected 4 parts in the output (image, caption, image, caption), but found ${parts.length}.`
      );
    }
    reporter.success("Output contains the correct number of parts.");

    // Validate Part 1: First image
    if (JSON.stringify(parts[0]) !== JSON.stringify(mockImage1)) {
      return reporter.fail(
        "The first part of the output should be the first input image."
      );
    }
    reporter.success("Part 1 is the correct image.");

    // Validate Part 2: First caption
    if (!parts[1].text || parts[1].text.trim() !== mockCaption1) {
      return reporter.fail(
        `The second part should be the caption for the first image. Expected "${mockCaption1}", but got "${parts[1].text?.trim()}".`
      );
    }
    reporter.success("Part 2 is the correct caption.");

    // Validate Part 3: Second image
    if (JSON.stringify(parts[2]) !== JSON.stringify(mockImage2)) {
      return reporter.fail(
        "The third part of the output should be the second input image."
      );
    }
    reporter.success("Part 3 is the correct image.");

    // Validate Part 4: Second caption
    if (!parts[3].text || parts[3].text.trim() !== mockCaption2) {
      return reporter.fail(
        `The fourth part should be the caption for the second image. Expected "${mockCaption2}", but got "${parts[3].text?.trim()}".`
      );
    }
    reporter.success("Part 4 is the correct caption.");
  })();

  // Test Case 2: No Images (Edge Case)
  reporter.progress("\n--- Running Test Case: No Images ---");
  await (async () => {
    // 1. Define mock input with no image parts.
    const emptyInput = {
      role: "user",
      parts: [],
    };

    // 2. Set up a strict mock that fails if called.
    let generateContentCallCount = 0;
    mocks.generate.onGenerateContent(async () => {
      generateContentCallCount++;
      reporter.fail(
        "generateContent should not be called when there are no input images."
      );
      return {
        candidates: [],
      };
    });

    // 3. Invoke the program.
    reporter.progress("Invoking the program with zero images.");
    const result = await invoke({
      input1: emptyInput,
    });

    // 4. Validate the results.
    if (generateContentCallCount > 0) {
      return reporter.fail(
        "Test failed because generateContent was called unexpectedly."
      );
    }
    reporter.success(
      "generateContent was not called, which is the correct behavior."
    );

    if (!result || !Array.isArray(result.parts) || result.parts.length !== 0) {
      return reporter.fail(
        `Expected an empty result when no images are provided, but got: ${JSON.stringify(result)}`
      );
    }
    reporter.success(
      "Program correctly returned an empty result for no images."
    );
  })();
};
