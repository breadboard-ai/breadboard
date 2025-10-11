export default async ({
  invoke,
  mocks
}) => {
  // Define the mock input images that the program will process.
  const mockInputImages = [{
    fileData: {
      fileUri: "/vfs/out/mock-image-1.jpg",
      mimeType: "image/jpeg",
    },
  }, {
    fileData: {
      fileUri: "/vfs/out/mock-image-2.png",
      mimeType: "image/png",
    },
  }, ];

  // Define the expected captions that the mocked Gemini API will return for each image.
  const expectedCaptions = [
    "Living my best life, one beautiful moment at a time. ✨",
    "Chasing sunsets and dreams. 🌅",
  ];

  let callCount = 0;

  // Set up a mock for the `generateContent` capability.
  // This function will be called by the program for each image to get a caption.
  mocks.generate.onGenerateContent(async (args) => {
    if (callCount >= mockInputImages.length) {
      throw new Error(
        `generateContent was called more times than there were images. Expected ${mockInputImages.length} calls, but received at least ${
          callCount + 1
        }.`
      );
    }

    // Verify the model being used is a fast, multimodal model.
    if (!args.model || !args.model.includes("flash")) {
      throw new Error(
        `Expected a fast multimodal model like 'gemini-2.5-flash'. Found: ${args.model}`
      );
    }

    // Verify that the prompt is well-formed for generating a caption.
    const lastContent = args.contents[args.contents.length - 1];
    if (!lastContent || !lastContent.parts || lastContent.parts.length < 2) {
      throw new Error(
        "The prompt to generate a caption must contain at least two parts: a text instruction and an image."
      );
    }

    const textPart = lastContent.parts.find((part) => "text" in part);
    const imagePart = lastContent.parts.find((part) => "fileData" in part);

    if (!textPart) {
      throw new Error("The generation request is missing a text instruction part.");
    }
    if (!imagePart) {
      throw new Error("The generation request is missing an image (fileData) part.");
    }

    // Check if the prompt text is asking for a caption for Instagram.
    const promptText = textPart.text.toLowerCase();
    if (!promptText.includes("caption") || !promptText.includes("instagram")) {
      throw new Error(
        `The prompt text seems incorrect. Expected it to ask for an "Instagram caption", but got: "${textPart.text}"`
      );
    }

    // Ensure the correct image is being sent with the request.
    const expectedImageUri = mockInputImages[callCount].fileData.fileUri;
    if (imagePart.fileData.fileUri !== expectedImageUri) {
      throw new Error(
        `The program sent the wrong image for captioning. Expected URI ${expectedImageUri}, but got ${imagePart.fileData.fileUri}.`
      );
    }

    // Return the pre-defined mock caption for the current image.
    const mockResponse = {
      candidates: [{
        content: {
          role: "model",
          parts: [{
            text: expectedCaptions[callCount]
          }],
        },
        finishReason: "STOP",
      }, ],
    };

    callCount++;
    return mockResponse;
  });

  // Execute the program with the mock input images.
  const result = await invoke({
    role: "user",
    parts: mockInputImages,
  });

  // Verify that `generateContent` was called for every image.
  if (callCount !== mockInputImages.length) {
    throw new Error(
      `The program did not process all images. Expected ${mockInputImages.length} calls to generateContent, but there were only ${callCount}.`
    );
  }

  // Verify the final output structure.
  const expectedPartCount = mockInputImages.length * 2; // Each image should have a corresponding caption.
  if (!result.parts || result.parts.length !== expectedPartCount) {
    throw new Error(
      `The final output should have ${expectedPartCount} parts (an image followed by a caption for each input), but it has ${
        result.parts?.length || 0
      }.`
    );
  }

  // Verify the content and order of the final output.
  for (let i = 0; i < mockInputImages.length; i++) {
    const imageIndex = i * 2;
    const captionIndex = i * 2 + 1;

    const resultImagePart = result.parts[imageIndex];
    const resultCaptionPart = result.parts[captionIndex];

    // Check if the part at `imageIndex` is the correct image.
    if (!("fileData" in resultImagePart) ||
      resultImagePart.fileData.fileUri !== mockInputImages[i].fileData.fileUri
    ) {
      throw new Error(
        `Output part at index ${imageIndex} should be the original image but was not. Found: ${JSON.stringify(
          resultImagePart
        )}`
      );
    }

    // Check if the part at `captionIndex` is the correct caption.
    if (!("text" in resultCaptionPart) ||
      resultCaptionPart.text !== expectedCaptions[i]
    ) {
      throw new Error(
        `Output part at index ${captionIndex} should be the generated caption but was not. Found: ${JSON.stringify(
          resultCaptionPart
        )}`
      );
    }
  }
};