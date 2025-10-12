/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export default async (inputs, capabilities) => {
  const {
    generate
  } = capabilities;
  const {
    console
  } = capabilities;

  const imageParts = inputs.parts.filter((part) => "fileData" in part);

  if (imageParts.length === 0) {
    return {
      parts: [{
        text: "No images were provided. Please provide one or more images to get captions."
      }, ],
    };
  }

  const outputParts = [];

  for (const imagePart of imageParts) {
    try {
      const result = await generate.generateContent({
        model: "gemini-2.5-pro",
        contents: [{
          role: "user",
          parts: [{
              text: "Provide a catchy caption suitable for an Instagram post for this image.",
            },
            imagePart,
          ],
        }, ],
      });

      const candidate = result.candidates[0];
      let caption = "[Could not generate a caption for this image.]";

      if (
        candidate &&
        candidate.content &&
        candidate.content.parts &&
        candidate.content.parts.length > 0 &&
        "text" in candidate.content.parts[0]
      ) {
        caption = candidate.content.parts[0].text;
      } else {
        console.error(
          "No text part found in the generated content for image:",
          imagePart.fileData.fileUri
        );
      }

      // Add the original image to the output
      outputParts.push(imagePart);
      // Add the generated caption to the output
      outputParts.push({
        text: `\n\n${caption}\n\n`
      });

    } catch (e) {
      console.error(
        `Error generating caption for image: ${imagePart.fileData.fileUri}`,
        e
      );
      // Still add the image even if caption generation fails
      outputParts.push(imagePart);
      outputParts.push({
        text: `\n\n[An error occurred while generating the caption.]\n\n`
      });
    }
  }

  return {
    parts: outputParts
  };
};