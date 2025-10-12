export default async (inputs, capabilities) => {
  const {
    generate,
    console
  } = capabilities;

  const imageParts = inputs.parts.filter((part) => "fileData" in part);

  if (imageParts.length === 0) {
    console.error("No images found in the input.");
    return {
      parts: [{
        text: "Error: No images were provided in the input."
      }]
    };
  }

  const outputParts = [];

  for (const imagePart of imageParts) {
    try {
      console.log(`Generating caption for image: ${imagePart.fileData.fileUri}`);

      const response = await generate.generateContent({
        model: "gemini-2.5-pro",
        contents: [{
          parts: [{
              text: "Provide a short, catchy caption suitable for an Instagram post for this image."
            },
            imagePart,
          ],
        }, ],
        generationConfig: {
          responseMimeType: "text/plain",
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate || !candidate.content) {
        console.error("No valid candidate found in the LLM response for image:", imagePart.fileData.fileUri);
        outputParts.push(imagePart);
        outputParts.push({
          text: "Could not generate a caption for this image."
        });
        continue;
      }

      const captionPart = candidate.content.parts[0];
      if ("text" in captionPart) {
        outputParts.push(imagePart);
        outputParts.push(captionPart);
      } else {
        console.error("LLM did not return a text part for image:", imagePart.fileData.fileUri);
        outputParts.push(imagePart);
        outputParts.push({
          text: "An unexpected response was received from the model."
        });
      }
    } catch (e) {
      console.error(`An error occurred while processing image ${imagePart.fileData.fileUri}:`, e);
      outputParts.push(imagePart);
      outputParts.push({
        text: `Error generating caption for this image: ${e.message}`
      });
    }
  }

  return {
    parts: outputParts
  };
};