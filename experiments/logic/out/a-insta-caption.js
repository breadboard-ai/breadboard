export default async (inputs, capabilities) => {
  const {
    generate,
    console
  } = capabilities;
  const {
    parts
  } = inputs;

  // Filter out any non-image parts from the input.
  const imageParts = parts.filter(part => "fileData" in part);

  if (imageParts.length === 0) {
    console.error("No images found in the input.");
    return {
      parts: [{
        text: "Error: No images were provided in the input."
      }]
    };
  }

  const outputParts = [];

  // Process each image part to generate a caption.
  for (const imagePart of imageParts) {
    const prompt = "Provide a catchy caption suitable for an Instagram post.";

    try {
      // Call the Gemini API with the image and the prompt.
      const response = await generate.generateContent({
        model: "gemini-2.5-pro",
        contents: [{
          parts: [{
            text: prompt
          }, imagePart],
        }, ],
      });

      // Extract the caption from the response.
      const candidate = response.candidates ?.[0];
      const captionPart = candidate ?.content ?.parts ?.[0];

      let caption = "Could not generate a caption for this image.";
      if (captionPart && "text" in captionPart) {
        caption = captionPart.text;
      } else {
        console.error("Failed to extract caption from the model response.", JSON.stringify(response));
      }

      // Add the original image and its new caption to the output.
      outputParts.push(imagePart);
      outputParts.push({
        text: `\n\n${caption.trim()}\n\n`
      });

    } catch (e) {
      console.error("An error occurred while generating a caption:", e);
      // If an error occurs, include the image and an error message in the output.
      outputParts.push(imagePart);
      outputParts.push({
        text: "\n\nError: Could not generate a caption for this image.\n\n"
      });
    }
  }

  return {
    parts: outputParts
  };
};