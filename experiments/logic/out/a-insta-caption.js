export default async (inputs, capabilities) => {
  const {
    generate,
    console
  } = capabilities;

  const imageParts = inputs.parts.filter(part => "fileData" in part && part.fileData.mimeType.startsWith("image/"));

  if (imageParts.length === 0) {
    return {
      parts: [{
        text: "No images were provided. Please provide one or more images to get captions."
      }, ],
    };
  }

  const outputParts = [];
  const captionPrompt = "Provide a catchy caption suitable for an Instagram post.";

  for (const imagePart of imageParts) {
    try {
      console.log(`Generating caption for ${imagePart.fileData.fileUri}`);
      const response = await generate.generateContent({
        model: "gemini-2.5-pro",
        contents: [{
          role: "user",
          parts: [{
            text: captionPrompt
          }, imagePart]
        }, ],
      });

      const candidate = response.candidates?.[0];
      const captionPart = candidate?.content?.parts?.[0];

      if (captionPart && 'text' in captionPart) {
        outputParts.push(imagePart);
        outputParts.push({
          text: `\n\n${captionPart.text.trim()}\n\n`
        });
      } else {
        console.error("Could not extract caption from response for:", imagePart.fileData.fileUri);
        outputParts.push(imagePart);
        outputParts.push({
          text: "\n\n---\n*Could not generate a caption for this image.*"
        });
      }
    } catch (e) {
      console.error("Error during caption generation for:", imagePart.fileData.fileUri, e);
      outputParts.push(imagePart);
      outputParts.push({
        text: `\n\n---\n*An error occurred while generating a caption: ${e.message}*`
      });
    }
  }

  return {
    parts: outputParts
  };
};