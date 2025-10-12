export default async (inputs, capabilities) => {
  const {
    input1
  } = inputs;
  const {
    generate,
    console
  } = capabilities;

  if (!input1 || !input1.parts || input1.parts.length === 0) {
    return {
      parts: [{
        text: "No input images were provided."
      }]
    };
  }

  const imageParts = input1.parts.filter(part => part.fileData);

  if (imageParts.length === 0) {
    return {
      parts: [{
        text: "No images found in the input. Please provide one or more images."
      }, ],
    };
  }

  const captionPromises = imageParts.map(async (imagePart) => {
    try {
      const response = await generate.generateContent({
        model: "gemini-2.5-pro",
        contents: [{
          parts: [{
            text: "Provide a short, catchy caption suitable for an Instagram post for this image. Include relevant emojis and hashtags."
          },
          imagePart,
          ],
        }, ],
      });

      const captionText = response.candidates ?.[0] ?.content ?.parts ?.[0] ?.text;

      if (!captionText) {
        throw new Error("The model did not return a caption.");
      }

      // Return a pair of [image, caption] for later collation
      return [
        imagePart, {
          text: `\n\n${captionText.trim()}\n\n`
        }
      ];
    } catch (error) {
      console.error("Failed to generate caption for an image:", error);
      // In case of an error, return the image with a fallback message
      return [
        imagePart, {
          text: "\n\nCould not generate a caption for this image.\n\n"
        },
      ];
    }
  });

  // Wait for all caption generation requests to complete
  const results = await Promise.all(captionPromises);

  // Flatten the array of [image, caption] pairs into a single array
  const finalParts = results.flat();

  return {
    parts: finalParts
  };
};