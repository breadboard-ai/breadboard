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


/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export default async (capabilities) => {
  const { mcp, generate, prompts, console } = capabilities;

  // Start by showing the initial topic input screen.
  await mcp.callTool({
    name: "screens_update_screens",
    arguments: {
      screenInputs: [
        {
          screenId: "get_topic",
          inputs: {},
        },
      ],
    },
  });

  // Main event loop to wait for and handle user interactions.
  while (true) {
    const userEventsResponse = await mcp.callTool({
      name: "screens_get_user_events",
      arguments: {},
    });

    for (const event of userEventsResponse.response.events) {
      switch (event.eventId) {
        case "write_post": {
          if (event.screenId === "get_topic") {
            const topic = event.output.topic;
            console.log(`Starting blog post generation for topic: "${topic}"`);

            // 1. Show the "in progress" screen while researching.
            await mcp.callTool({
              name: "screens_update_screens",
              arguments: {
                screenInputs: [
                  {
                    screenId: "writing_in_progress",
                    inputs: {
                      status: "Researching topic and creating outline...",
                    },
                  },
                ],
              },
            });

            // 2. Research the topic and generate an outline.
            const researchAndOutline = await callJsonPrompt(
              generate,
              prompts,
              "create-outline",
              { topic }
            );
            const researchAndOutlineJson = JSON.stringify(researchAndOutline);
            console.log("Outline and research complete.");

            // 3. Update status to reflect the next steps.
            await mcp.callTool({
              name: "screens_update_screens",
              arguments: {
                screenInputs: [
                  {
                    screenId: "writing_in_progress",
                    inputs: {
                      status:
                        "Generating header graphic and writing the post...",
                    },
                  },
                ],
              },
            });

            // 4. Start the parallel tasks: writing the post and generating the graphic.
            console.log("Starting parallel tasks: writing post and generating image.");

            // Task A: Write the blog post.
            const blogPostPromise = callTextPrompt(
              generate,
              prompts,
              "write-blog-post",
              { research_and_outline_json: researchAndOutlineJson }
            );

            // Task B: Generate the header graphic (this is a two-step process).
            const headerGraphicPromise = callJsonPrompt(
              generate,
              prompts,
              "create-image-prompt",
              { research_and_outline_json: researchAndOutlineJson }
            ).then((imagePromptResult) => {
              console.log("Image prompt created, now generating image.");
              return callImagePrompt(
                generate,
                prompts,
                "generate-header-graphic",
                { prompt: imagePromptResult.image_prompt }
              );
            });

            // 5. Wait for both parallel tasks to complete.
            const [blog_post, header_graphic] = await Promise.all([
              blogPostPromise,
              headerGraphicPromise,
            ]);
            console.log("All tasks completed.");

            // 6. Display the final result.
            await mcp.callTool({
              name: "screens_update_screens",
              arguments: {
                screenInputs: [
                  {
                    screenId: "show_result",
                    inputs: {
                      blog_post,
                      header_graphic,
                    },
                  },
                ],
              },
            });
          }
          break;
        }

        case "start_over": {
          if (event.screenId === "show_result") {
            console.log("Starting over.");
            // Reset the application to the initial screen.
            await mcp.callTool({
              name: "screens_update_screens",
              arguments: {
                screenInputs: [
                  {
                    screenId: "get_topic",
                    inputs: {},
                  },
                ],
              },
            });
          }
          break;
        }

        default: {
          console.log(`Unknown event: ${event.eventId}`);
          break;
        }
      }
    }
  }
};
