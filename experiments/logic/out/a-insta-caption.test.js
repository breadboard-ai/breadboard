/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A simple deep-equal function for comparing objects, useful for assertions.
const deepEqual = (a, b) => {
  return JSON.stringify(a) === JSON.stringify(b);
};

export default async (invoke, mocks) => {
  // 1. === Setup Mocks ===
  // Define the mock image data that the program will receive as input.
  const mockImages = [
    {
      fileData: {
        fileUri: "/vfs/in/image1.png",
        mimeType: "image/png"
      },
    },
    {
      fileData: {
        fileUri: "/vfs/in/image2.jpeg",
        mimeType: "image/jpeg"
      },
    },
  ];

  // Define the mock captions that the Gemini model will "generate".
  const mockCaptions = [
    "Living my best life, one snapshot at a time. ✨",
    "Chasing sunsets and dreams. 🌅",
  ];

  // Keep track of how many times the generateContent function is called.
  let generateContentCallCount = 0;

  // Set up the mock for the `generateContent` capability.
  mocks.generate.onGenerateContent(async (args) => {
    generateContentCallCount++;

    // Validate the structure of the call to the Gemini API.
    if (!args.contents || args.contents.length === 0) {
      throw new Error("generateContent was called with no `contents`.");
    }

    const lastContent = args.contents[args.contents.length - 1];
    if (!lastContent.parts || lastContent.parts.length < 2) {
      throw new Error(
        "generateContent call is missing the required parts (expected at least a text prompt and an image)."
      );
    }

    const textPart = lastContent.parts.find((part) => "text" in part);
    const imagePart = lastContent.parts.find((part) => "fileData" in part);

    if (!textPart || !imagePart) {
      throw new Error(
        "generateContent call must include both a text part and a fileData part."
      );
    }

    // A loose check to ensure the prompt is asking for a caption.
    if (!textPart.text.toLowerCase().includes("caption")) {
      throw new Error(
        `Expected prompt to ask for a caption, but received: "${textPart.text}"`
      );
    }

    // Find which of our mock images was sent in this call.
    const imageIndex = mockImages.findIndex((img) =>
      deepEqual(img, imagePart)
    );

    if (imageIndex === -1) {
      throw new Error(
        `generateContent was called with an unexpected image: ${JSON.stringify(
          imagePart
        )}`
      );
    }

    // Return the pre-defined caption for the received image.
    return {
      candidates: [{
        content: {
          parts: [{
            text: mockCaptions[imageIndex]
          }],
        },
      }, ],
    };
  });

  // 2. === Define Inputs ===
  // The input to the program is an LLMContent object containing the image parts.
  const inputs = {
    parts: mockImages,
  };

  // 3. === Invoke the Program ===
  const result = await invoke(inputs, mocks.capabilities);

  // 4. === Assert the Results ===
  // The program should call the Gemini API once for each image.
  if (generateContentCallCount !== mockImages.length) {
    throw new Error(
      `Expected generateContent to be called ${mockImages.length} times, but it was called ${generateContentCallCount} times.`
    );
  }

  // The output should be a valid LLMContent object.
  if (!result || !result.parts) {
    throw new Error(
      `Expected a result with a 'parts' array, but got: ${JSON.stringify(
        result
      )}`
    );
  }

  // The output should contain one image part and one text part for each input image.
  const expectedPartsCount = mockImages.length * 2;
  if (result.parts.length !== expectedPartsCount) {
    throw new Error(
      `Expected ${expectedPartsCount} parts in the output, but received ${result.parts.length}.`
    );
  }

  // Verify that the output parts are correctly collated (image, caption, image, caption, ...).
  for (let i = 0; i < mockImages.length; i++) {
    const imagePartIndex = i * 2;
    const captionPartIndex = i * 2 + 1;

    const actualImagePart = result.parts[imagePartIndex];
    const actualCaptionPart = result.parts[captionPartIndex];

    const expectedImagePart = mockImages[i];
    const expectedCaptionText = mockCaptions[i];

    // Check if the image part is correct.
    if (!deepEqual(actualImagePart, expectedImagePart)) {
      throw new Error(
        `Output part at index ${imagePartIndex} is incorrect.
Expected image: ${JSON.stringify(expectedImagePart)}
Actual image: ${JSON.stringify(actualImagePart)}`
      );
    }

    // Check if the caption part is correct.
    if (
      !("text" in actualCaptionPart) ||
      actualCaptionPart.text.trim() !== expectedCaptionText
    ) {
      throw new Error(
        `Output part at index ${captionPartIndex} is incorrect.
Expected caption: "${expectedCaptionText}"
Actual caption: "${actualCaptionPart?.text?.trim()}"`
      );
    }
  }
};