/**
 * Helper function to call a prompt that expects a JSON response.
 * @param {object} generate - The Gemini generate capability.
 * @param {object} prompts - The prompts capability.
 * @param {string} promptName - The name of the prompt to call.
 * @param {object} [args] - The arguments to pass to the prompt.
 * @returns {Promise<object>} The parsed JSON response.
 */
export async function callJsonPrompt(generate, prompts, promptName, args = {}) {
  const prompt = await prompts.get(promptName, args);
  const response = await generate.generateContent({
    model: "gemini-2.5-pro",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt.value,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: prompt.responseSchema,
    },
  });
  const candidate = response.candidates[0];
  if (!candidate || !candidate.content) {
    throw new Error(`Prompt ${promptName} failed to generate content.`);
  }
  const textPart = candidate.content.parts.find((part) => "text" in part);
  if (!textPart) {
    throw new Error(`No text part in response for ${promptName}.`);
  }
  return JSON.parse(textPart.text);
}

/**
 * Helper function to call a prompt that expects a text response.
 * @param {object} generate - The Gemini generate capability.
 * @param {object} prompts - The prompts capability.
 * @param {string} promptName - The name of the prompt to call.
 * @param {object} [args] - The arguments to pass to the prompt.
 * @returns {Promise<string>} The text response.
 */
export async function callTextPrompt(generate, prompts, promptName, args = {}) {
  const prompt = await prompts.get(promptName, args);
  const response = await generate.generateContent({
    model: "gemini-2.5-pro",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt.value,
          },
        ],
      },
    ],
  });
  const candidate = response.candidates[0];
  if (!candidate || !candidate.content) {
    throw new Error(`Prompt ${promptName} failed to generate content.`);
  }
  const textPart = candidate.content.parts.find((part) => "text" in part);
  if (!textPart) {
    throw new Error(`No text part in response for ${promptName}.`);
  }
  return textPart.text;
}

/**
 * Helper function to call a prompt that expects an image response.
 * @param {object} generate - The Gemini generate capability.
 * @param {object} prompts - The prompts capability.
 * @param {string} promptName - The name of the prompt to call.
 * @param {object} [args] - The arguments to pass to the prompt.
 * @returns {Promise<string>} The VFS path to the generated image.
 */
export async function callImagePrompt(
  generate,
  prompts,
  promptName,
  args = {}
) {
  const prompt = await prompts.get(promptName, args);
  const response = await generate.generateContent({
    model: "gemini-2.5-flash-image-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt.value,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  });
  const candidate = response.candidates[0];
  if (!candidate || !candidate.content) {
    throw new Error(`Prompt ${promptName} failed to generate an image.`);
  }
  const filePart = candidate.content.parts.find((part) => "fileData" in part);
  if (!filePart) {
    throw new Error(`No image part in response for ${promptName}.`);
  }
  return filePart.fileData.fileUri;
}
