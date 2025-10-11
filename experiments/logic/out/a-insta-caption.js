export default async (inputs, capabilities) => {
  const { generate, console } = capabilities;

  // Filter out the parts that are actual images.
  const imageParts = inputs.parts.filter(
    (part) => part.fileData && part.fileData.mimeType.startsWith("image/")
  );

  if (imageParts.length === 0) {
    console.log("No images found in the input.");
    return { parts: [{ text: "Please provide one or more images to get captions." }] };
  }

  // Create an array of promises, one for each image, to generate a caption.
  const captionGenerationPromises = imageParts.map((imagePart) => {
    return generate.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        {
          parts: [
            {
              text: "Provide a short, catchy caption suitable for an Instagram post for this image. Include a few relevant hashtags.",
            },
            imagePart,
          ],
        },
      ],
    });
  });

  // Wait for all the caption generation requests to complete.
  const responses = await Promise.all(captionGenerationPromises);

  // Collate the results into a single output array: [image1, caption1, image2, caption2, ...]
  const outputParts = [];
  responses.forEach((response, index) => {
    // First, add the original image part.
    outputParts.push(imageParts[index]);

    // Then, extract the caption text and add it as a new text part.
    try {
      const caption = response.candidates[0].content.parts[0].text;
      outputParts.push({ text: `\n\n${caption.trim()}\n\n` });
    } catch (e) {
      console.error(`Failed to generate caption for image ${index}:`, e);
      outputParts.push({ text: "\n\n[Caption generation failed for this image.]\n\n" });
    }
  });

  return {
    parts: outputParts,
  };
};