export default async (inputs, capabilities) => {
  const {
    generate,
    console
  } = capabilities;
  const {
    input1
  } = inputs;

  if (!input1 || !input1.parts || input1.parts.length === 0) {
    console.log("No input images provided.");
    return {
      parts: []
    };
  }

  const imageParts = input1.parts.filter(part => part.fileData);

  if (imageParts.length === 0) {
    console.log("Input did not contain any valid images.");
    return {
      parts: []
    };
  }

  const outputParts = [];

  for (const imagePart of imageParts) {
    try {
      const response = await generate.generateContent({
        model: "gemini-1.5-pro-latest",
        contents: [{
          role: "user",
          parts: [{
            text: "Provide a catchy caption suitable for an Instagram post."
          }, imagePart],
        }, ],
      });

      const caption = response.candidates ?.[0] ?.content ?.parts ?.[0] ?.text ??
        "Sorry, I couldn't generate a caption for this image.";

      // Add the original image part to the output
      outputParts.push(imagePart);
      // Add the generated caption part to the output, with some spacing
      outputParts.push({
        text: `\n\n${caption}\n\n`
      });

    } catch (e) {
      console.error("Error generating caption for an image:", e);
      // In case of an error, still include the image and an error message
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