export default async (invoke, mocks, reporter) => {
  // Test Case 1: Multiple images are provided.
  reporter.progress("Starting test case 1: Process multiple images.");

  const mockImage1 = {
    fileData: { fileUri: "/vfs/testing/image1.png", mimeType: "image/png" },
  };
  const mockImage2 = {
    fileData: { fileUri: "/vfs/testing/image2.jpeg", mimeType: "image/jpeg" },
  };
  const mockCaption1 = "Living my best life! ✨ #vacation";
  const mockCaption2 = "Chasing sunsets and dreams. 🌅 #nature";

  const inputs = {
    input1: {
      role: "user",
      parts: [mockImage1, mockImage2],
    },
  };

  let generateContentCallCount = 0;
  mocks.generate.onGenerateContent(async (args) => {
    generateContentCallCount++;
    reporter.progress(`Gemini generateContent called (${generateContentCallCount} time(s)).`);

    // The program should send a prompt asking for a caption along with one image.
    const textPart = args.contents[0]?.parts.find(part => part.text);
    const imagePart = args.contents[0]?.parts.find(part => part.fileData);

    if (!textPart || !textPart.text.toLowerCase().includes("caption")) {
       reporter.fail(`Expected a prompt asking for a caption, but got: "${textPart?.text}"`);
       return { candidates: [] };
    }

    if (!imagePart) {
       reporter.fail("Expected an image part in the call to generateContent.");
       return { candidates: [] };
    }

    // Return a mock caption based on which image was sent.
    if (imagePart.fileData.fileUri === mockImage1.fileData.fileUri) {
      reporter.progress("Returning caption for image 1.");
      return {
        candidates: [{ content: { parts: [{ text: mockCaption1 }] } }],
      };
    } else if (imagePart.fileData.fileUri === mockImage2.fileData.fileUri) {
      reporter.progress("Returning caption for image 2.");
      return {
        candidates: [{ content: { parts: [{ text: mockCaption2 }] } }],
      };
    } else {
      reporter.fail(`generateContent called with an unexpected image URI: ${imagePart.fileData.fileUri}`);
      return { candidates: [] };
    }
  });

  reporter.progress("Invoking the program with two images...");
  const result = await invoke(inputs);
  reporter.progress("Program finished.");

  if (!result || !Array.isArray(result.parts)) {
    return reporter.fail("The program's output is not valid or is missing the 'parts' array.");
  }

  const { parts } = result;

  if (generateContentCallCount !== 2) {
    return reporter.fail(`Expected generateContent to be called 2 times, but it was called ${generateContentCallCount} times.`);
  }

  if (parts.length !== 4) {
    return reporter.fail(`Expected 4 parts in the output (image, caption, image, caption), but got ${parts.length}.`);
  }

  // Check the order and content of the output parts
  if (JSON.stringify(parts[0]) !== JSON.stringify(mockImage1)) {
    return reporter.fail(`Part 1 should be the first image. Got: ${JSON.stringify(parts[0])}`);
  }
  if (!parts[1].text || !parts[1].text.includes(mockCaption1)) {
    return reporter.fail(`Part 2 should be the caption for the first image. Got: ${JSON.stringify(parts[1])}`);
  }
  if (JSON.stringify(parts[2]) !== JSON.stringify(mockImage2)) {
    return reporter.fail(`Part 3 should be the second image. Got: ${JSON.stringify(parts[2])}`);
  }
  if (!parts[3].text || !parts[3].text.includes(mockCaption2)) {
    return reporter.fail(`Part 4 should be the caption for the second image. Got: ${JSON.stringify(parts[3])}`);
  }

  reporter.success("Test case 1 passed: Correctly processed multiple images.");


  // Test Case 2: Input contains text parts which should be ignored.
  reporter.progress("\nStarting test case 2: Process mixed content (text and images).");
  
  const mixedInputs = {
      input1: {
          role: "user",
          parts: [
              { text: "Please generate captions for these photos from my trip:" },
              mockImage1,
              { text: "And this one too:" },
              mockImage2
          ]
      }
  };
  
  generateContentCallCount = 0; // Reset counter
  
  reporter.progress("Invoking the program with mixed content...");
  const mixedResult = await invoke(mixedInputs);
  reporter.progress("Program finished.");

  if (!mixedResult || !Array.isArray(mixedResult.parts)) {
    return reporter.fail("The program's output for mixed content is not valid.");
  }
  
  if (generateContentCallCount !== 2) {
    return reporter.fail(`Expected generateContent to be called 2 times for mixed input, but it was called ${generateContentCallCount} times.`);
  }

  if (mixedResult.parts.length !== 4) {
    return reporter.fail(`Expected 4 parts in the output for mixed input, but got ${mixedResult.parts.length}. Text parts should be ignored.`);
  }

  reporter.success("Test case 2 passed: Correctly ignored non-image parts in input.");


  // Test Case 3: No images are provided.
  reporter.progress("\nStarting test case 3: Handle input with no images.");

  const emptyInputs = {
    input1: { role: "user", parts: [{ text: "There are no images here." }] },
  };

  generateContentCallCount = 0; // Reset counter

  reporter.progress("Invoking the program with no images...");
  const emptyResult = await invoke(emptyInputs);
  reporter.progress("Program finished.");

  if (generateContentCallCount > 0) {
    return reporter.fail(`generateContent should not be called when no images are provided, but it was called ${generateContentCallCount} times.`);
  }
  
  if (!emptyResult || !Array.isArray(emptyResult.parts) || emptyResult.parts.length !== 0) {
    return reporter.fail(`Expected an empty 'parts' array when no images are provided, but got: ${JSON.stringify(emptyResult)}`);
  }

  reporter.success("Test case 3 passed: Correctly handled input with no images.");
};