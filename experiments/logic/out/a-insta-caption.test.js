/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export default async (invoke, mocks, reporter) => {
  const {
    onGenerateContent
  } = mocks.generate;

  // A helper for deep equality checks, useful for complex objects.
  const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  reporter.progress("Starting test: Instagram Caption Generation");

  // 1. DEFINE MOCK DATA
  reporter.progress("Defining mock input images and expected captions.");
  const mockImage1 = {
    fileData: {
      fileUri: "/vfs/test/image_of_a_cat.png",
      mimeType: "image/png",
    },
  };
  const mockImage2 = {
    fileData: {
      fileUri: "/vfs/test/image_of_a_dog.jpeg",
      mimeType: "image/jpeg",
    },
  };
  const mockInput = {
    parts: [mockImage1, mockImage2],
  };

  const expectedCaption1 = "Pawsitively purrfect! 🐾 #CatLife #InstaCat";
  const expectedCaption2 = "Having a ruff day? This should help! 🐶 #Doggo #GoodBoy";

  const calls = [];

  // 2. SET UP MOCKS
  reporter.progress("Setting up mock for generate.generateContent.");
  onGenerateContent(async (args) => {
    // Keep track of calls for later inspection.
    calls.push(args);

    // The program should call the LLM once for each image.
    // The prompt should contain a text part and exactly one image part.
    const parts = args.contents[0].parts;
    const textPart = parts.find((p) => "text" in p);
    const imagePart = parts.find((p) => "fileData" in p);

    if (!textPart || !imagePart || parts.length !== 2) {
      throw new Error(
        `Expected prompt to contain exactly one text part and one image part. Found ${parts.length} parts.`
      );
    }

    // The text prompt should ask for a caption.
    if (!textPart.text.toLowerCase().includes("caption")) {
      throw new Error(
        `The prompt text does not seem to be asking for a caption. Text was: "${textPart.text}"`
      );
    }

    // Return a different caption based on which image was sent.
    if (imagePart.fileData.fileUri === mockImage1.fileData.fileUri) {
      return {
        candidates: [{
          content: {
            parts: [{
              text: expectedCaption1
            }],
          },
        }, ],
      };
    } else if (imagePart.fileData.fileUri === mockImage2.fileData.fileUri) {
      return {
        candidates: [{
          content: {
            parts: [{
              text: expectedCaption2
            }],
          },
        }, ],
      };
    } else {
      throw new Error(
        `generateContent called with an unexpected image URI: ${imagePart.fileData.fileUri}`
      );
    }
  });

  // 3. INVOKE THE PROGRAM
  reporter.progress("Invoking the program with two mock images.");
  const result = await invoke(mockInput);

  // 4. ASSERT THE RESULTS
  reporter.progress("Asserting the results...");

  // Check that the LLM was called twice, once for each image.
  if (calls.length !== 2) {
    reporter.fail(
      `Expected generateContent to be called 2 times, but it was called ${calls.length} times.`
    );
    return;
  }
  reporter.success("generateContent was called the correct number of times (2).");

  // Check the final output structure.
  if (!result || !Array.isArray(result.parts) || result.parts.length !== 4) {
    reporter.fail(
      `Expected the output to have 4 parts (image, caption, image, caption), but found ${
        result?.parts?.length || 0
      }.`
    );
    return;
  }
  reporter.success("Output has the correct number of parts (4).");

  // Check part 1: The first image.
  if (!deepEqual(result.parts[0], mockImage1)) {
    reporter.fail(
      `Part 1: Expected the first input image, but got ${JSON.stringify(
        result.parts[0]
      )}.`
    );
    return;
  }
  reporter.success("Part 1 is the correct first image.");

  // Check part 2: The caption for the first image.
  if (!result.parts[1].text || !result.parts[1].text.includes(expectedCaption1)) {
    reporter.fail(
      `Part 2: Expected caption for the first image, but got "${result.parts[1].text}".`
    );
    return;
  }
  reporter.success("Part 2 is the correct caption for the first image.");

  // Check part 3: The second image.
  if (!deepEqual(result.parts[2], mockImage2)) {
    reporter.fail(
      `Part 3: Expected the second input image, but got ${JSON.stringify(
        result.parts[2]
      )}.`
    );
    return;
  }
  reporter.success("Part 3 is the correct second image.");

  // Check part 4: The caption for the second image.
  if (!result.parts[3].text || !result.parts[3].text.includes(expectedCaption2)) {
    reporter.fail(
      `Part 4: Expected caption for the second image, but got "${result.parts[3].text}".`
    );
    return;
  }
  reporter.success("Part 4 is the correct caption for the second image.");

  reporter.progress("All checks passed!");
};