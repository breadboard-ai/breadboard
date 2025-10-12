/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export default async (invoke, mocks, reporter) => {
  // Test Case 1: Processes multiple images, ignores non-image parts,
  // and collates the output correctly.
  await (async () => {
    const testCaseName = "[TC1: Multiple Images & Mixed Content]";
    reporter.progress(`--- Starting ${testCaseName} ---`);

    const mockImage1 = {
      fileData: {
        fileUri: "/vfs/testing/image1.jpeg",
        mimeType: "image/jpeg",
      },
    };
    const mockImage2 = {
      fileData: {
        fileUri: "/vfs/testing/image2.png",
        mimeType: "image/png",
      },
    };
    const mockTextPart = {
      text: "This text part should be ignored by the program.",
    };

    const mockInputs = {
      input1: {
        parts: [mockImage1, mockTextPart, mockImage2],
      },
    };

    const expectedCaption1 = "A stunning sunset over the mountains.";
    const expectedCaption2 = "A playful puppy chasing a ball in a sunny field.";

    let generateContentCallCount = 0;
    const receivedImageUris = new Set();

    mocks.generate.onGenerateContent(async (args) => {
      generateContentCallCount++;
      reporter.progress(
        `${testCaseName} generateContent call #${generateContentCallCount}`
      );

      // The program should send one image at a time for captioning.
      const imagePart = args.contents[args.contents.length - 1]?.parts.find(
        (p) => p.fileData
      );

      if (!imagePart) {
        throw new Error(
          `${testCaseName} generateContent was called without an image part.`
        );
      }

      receivedImageUris.add(imagePart.fileData.fileUri);

      let caption = "";
      if (imagePart.fileData.fileUri === mockImage1.fileData.fileUri) {
        caption = expectedCaption1;
      } else if (imagePart.fileData.fileUri === mockImage2.fileData.fileUri) {
        caption = expectedCaption2;
      } else {
        throw new Error(
          `${testCaseName} Unexpected image URI: ${imagePart.fileData.fileUri}`
        );
      }

      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: caption,
                },
              ],
            },
          },
        ],
      };
    });

    reporter.progress(
      `${testCaseName} Invoking the program with two images and one text part.`
    );
    const result = await invoke(mockInputs);
    reporter.progress(`${testCaseName} Invocation complete.`);

    // Assertions for Test Case 1
    if (generateContentCallCount !== 2) {
      return reporter.fail(
        `${testCaseName} Expected 2 calls to generateContent for 2 images, but got ${generateContentCallCount}.`
      );
    }
    if (
      !receivedImageUris.has(mockImage1.fileData.fileUri) ||
      !receivedImageUris.has(mockImage2.fileData.fileUri)
    ) {
      return reporter.fail(
        `${testCaseName} generateContent was not called with all the expected image URIs.`
      );
    }
    reporter.success(
      `${testCaseName} generateContent was called the correct number of times with the correct images.`
    );

    if (!result?.parts || result.parts.length !== 4) {
      return reporter.fail(
        `${testCaseName} Expected 4 parts in the output (image, caption, image, caption), but got ${
          result?.parts?.length || 0
        }.`
      );
    }
    reporter.success(
      `${testCaseName} Output has the correct number of parts (4).`
    );

    const [part1, part2, part3, part4] = result.parts;

    if (part1?.fileData?.fileUri !== mockImage1.fileData.fileUri) {
      return reporter.fail(`${testCaseName} Part 1 is not the first input image.`);
    }
    if (part2?.text?.trim() !== expectedCaption1) {
      return reporter.fail(
        `${testCaseName} Part 2 is not the correct caption for the first image.`
      );
    }
    if (part3?.fileData?.fileUri !== mockImage2.fileData.fileUri) {
      return reporter.fail(`${testCaseName} Part 3 is not the second input image.`);
    }
    if (part4?.text?.trim() !== expectedCaption2) {
      return reporter.fail(
        `${testCaseName} Part 4 is not the correct caption for the second image.`
      );
    }
    reporter.success(
      `${testCaseName} All output parts are correct and in the expected order.`
    );
  })();

  // Test Case 2: Handles input with no images.
  await (async () => {
    const testCaseName = "[TC2: No Images]";
    reporter.progress(`--- Starting ${testCaseName} ---`);

    const mockInputs = {
      input1: {
        parts: [
          {
            text: "Just some text, no images here.",
          },
        ],
      },
    };

    let generateContentCallCount = 0;
    mocks.generate.onGenerateContent(async () => {
      generateContentCallCount++;
      // This should not be called, but we provide a valid return just in case.
      return {
        candidates: [],
      };
    });

    reporter.progress(`${testCaseName} Invoking the program with no images.`);
    const result = await invoke(mockInputs);
    reporter.progress(`${testCaseName} Invocation complete.`);

    if (generateContentCallCount > 0) {
      return reporter.fail(
        `${testCaseName} Expected generateContent to not be called, but it was called ${generateContentCallCount} times.`
      );
    }

    if (!result?.parts || result.parts.length !== 0) {
      return reporter.fail(
        `${testCaseName} Expected an empty parts array in the output, but got ${JSON.stringify(
          result?.parts
        )}.`
      );
    }

    reporter.success(
      `${testCaseName} Correctly handled input with no images, producing an empty output.`
    );
  })();

  // Test Case 3: Handles completely empty input.
  await (async () => {
    const testCaseName = "[TC3: Empty Input]";
    reporter.progress(`--- Starting ${testCaseName} ---`);

    const mockInputs = {
      input1: {
        parts: [],
      },
    };

    let generateContentCallCount = 0;
    mocks.generate.onGenerateContent(async () => {
      generateContentCallCount++;
      return {
        candidates: [],
      };
    });

    reporter.progress(
      `${testCaseName} Invoking the program with an empty parts array.`
    );
    const result = await invoke(mockInputs);
    reporter.progress(`${testCaseName} Invocation complete.`);

    if (generateContentCallCount > 0) {
      return reporter.fail(
        `${testCaseName} Expected generateContent to not be called, but it was called ${generateContentCallCount} times.`
      );
    }

    if (!result?.parts || result.parts.length !== 0) {
      return reporter.fail(
        `${testCaseName} Expected an empty parts array in the output, but got ${JSON.stringify(
          result?.parts
        )}.`
      );
    }

    reporter.success(
      `${testCaseName} Correctly handled an empty input parts array.`
    );
  })();
};