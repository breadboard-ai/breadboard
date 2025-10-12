export default async (invoke, mocks, reporter) => {
  /**
   * A reusable test runner for different scenarios.
   * @param {object} options
   * @param {string} options.name - The name of the test case.
   * @param {FileDataPart[]} options.mockImages - An array of image parts to be used as input.
   * @param {string[]} options.mockCaptions - An array of captions the mock LLM should return.
   */
  const runTestCase = async ({ name, mockImages, mockCaptions }) => {
    reporter.progress(`--- Running test case: "${name}" ---`);

    let callCount = 0;
    const errors = [];

    // Set up the mock for the Gemini API call.
    mocks.generate.onGenerateContent(async (args) => {
      // Ensure the mock is not called more than expected.
      if (callCount >= mockImages.length) {
        errors.push(
          `generateContent was called more than the expected ${mockImages.length} times.`
        );
        // Return a valid empty response to prevent downstream errors.
        return {
          candidates: [],
        };
      }

      reporter.progress(
        `Verifying generateContent call ${callCount + 1}/${mockImages.length}`
      );

      const parts = args.contents?.[0]?.parts;
      if (!parts) {
        errors.push("generateContent was called with no parts in contents.");
        return {
          candidates: [],
        };
      }

      // Verify that each call contains exactly one image.
      const imageParts = parts.filter((part) => "fileData" in part);
      if (imageParts.length !== 1) {
        errors.push(
          `Expected 1 image part in generateContent call, but got ${imageParts.length}.`
        );
      } else if (
        imageParts[0].fileData.fileUri !==
        mockImages[callCount].fileData.fileUri
      ) {
        errors.push(
          `Expected image URI ${
            mockImages[callCount].fileData.fileUri
          } but got ${imageParts[0].fileData.fileUri}`
        );
      }

      // Verify the prompt is asking for a caption for Instagram.
      const textParts = parts.filter((part) => "text" in part);
      const promptText = textParts[0]?.text?.toLowerCase() ?? "";
      if (
        !promptText.includes("caption") ||
        !promptText.includes("instagram")
      ) {
        errors.push(
          `The prompt did not seem to ask for a catchy Instagram caption. Got: "${
            textParts[0]?.text
          }"`
        );
      }

      // Return the mock caption.
      const response = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: mockCaptions[callCount],
                },
              ],
            },
          },
        ],
      };

      callCount++;
      return response;
    });

    reporter.progress("Invoking the program...");
    const result = await invoke({
      parts: mockImages,
    });
    reporter.progress("Program finished. Verifying output...");

    if (callCount !== mockImages.length) {
      errors.push(
        `Expected generateContent to be called ${mockImages.length} times, but it was called ${callCount} times.`
      );
    }

    // Verify the structure and content of the final output.
    const expectedPartsLength = mockImages.length * 2;
    if (result.parts.length !== expectedPartsLength) {
      errors.push(
        `Expected ${expectedPartsLength} parts in the output, but got ${result.parts.length}.`
      );
    } else {
      for (let i = 0; i < mockImages.length; i++) {
        const imageIndex = i * 2;
        const captionIndex = i * 2 + 1;

        const resultImagePart = result.parts[imageIndex];
        const resultCaptionPart = result.parts[captionIndex];
        const expectedImagePart = mockImages[i];
        const expectedCaption = mockCaptions[i];

        // Check if the image part is correct.
        if (
          !resultImagePart?.fileData ||
          resultImagePart.fileData.fileUri !==
            expectedImagePart.fileData.fileUri
        ) {
          errors.push(
            `Output part at index ${imageIndex} is not the correct image. Expected URI ${expectedImagePart.fileData.fileUri}, got ${resultImagePart?.fileData?.fileUri}`
          );
        }

        // Check if the caption part is correct, allowing for extra whitespace.
        if (
          !resultCaptionPart?.text ||
          resultCaptionPart.text.trim() !== expectedCaption
        ) {
          errors.push(
            `Output part at index ${captionIndex} is not the correct caption. Expected "${expectedCaption}", got "${resultCaptionPart?.text?.trim()}"`
          );
        }
      }
    }

    if (errors.length > 0) {
      reporter.fail(
        `Test case "${name}" failed with ${
          errors.length
        } error(s): \n- ${errors.join("\n- ")}`
      );
    } else {
      reporter.success(`Test case "${name}" passed!`);
    }
  };

  // Test case 1: A typical scenario with multiple images.
  await runTestCase({
    name: "Multiple Images",
    mockImages: [
      {
        fileData: {
          fileUri: "/vfs/in/image-cat.png",
          mimeType: "image/png",
        },
      },
      {
        fileData: {
          fileUri: "/vfs/in/image-dog.jpeg",
          mimeType: "image/jpeg",
        },
      },
    ],
    mockCaptions: [
      "Just feline good today! 😺 #CatLife #Purrfect",
      "Having a ruff day? Here's a picture of me! 🐶 #Doggo #GoodBoy",
    ],
  });

  // Test case 2: A single image to test loop logic.
  await runTestCase({
    name: "Single Image",
    mockImages: [
      {
        fileData: {
          fileUri: "/vfs/in/sunset.webp",
          mimeType: "image/webp",
        },
      },
    ],
    mockCaptions: ["Chasing the sun. ✨ #SunsetLover #GoldenHour"],
  });

  // Test case 3: An empty input to test the edge case.
  await runTestCase({
    name: "No Images",
    mockImages: [],
    mockCaptions: [],
  });
};
