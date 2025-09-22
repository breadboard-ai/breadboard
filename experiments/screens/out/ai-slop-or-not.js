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


/**
 * @license
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

export default async function({
  mcp,
  prompts,
  generate,
  console
}) {
  // Main game loop to allow for "Play Again" functionality.
  while (true) {
    // 1. START: Display the start screen and wait for the user to provide a topic.
    await mcp.callTool({
      name: 'screens_update_screens',
      arguments: {
        screenInputs: [{
          screenId: 'start_screen',
          inputs: {}
        }],
      },
    });

    let userEventResponse = await mcp.callTool({
      name: 'screens_get_user_events',
      arguments: {},
    });
    const startEvent = userEventResponse.response.events[0];

    // Ensure we handle the correct event before starting.
    if (startEvent.eventId !== 'start_game' || !startEvent.output.topic) {
      console.error('Expected a start_game event with a topic, but got:', startEvent);
      // In a real app, you might want to show an error screen. Here, we'll just exit.
      return {
        parts: [{
          text: 'Error: Invalid start event.'
        }]
      };
    }
    const topic = startEvent.output.topic;
    console.log(`Game started with topic: "${topic}"`);

    // Initialize game state.
    let roundNumber = 1;
    const TOTAL_ROUNDS = 10;
    // Use an object to track each image's VFS path and its survival count.
    const imageSurvivalData = {};

    // 2. INITIAL ROUND: Generate the first two images.
    console.log('Generating initial images for Round 1...');
    const imageAPath = await callImagePrompt(generate, prompts, 'generate-image', {
      topic
    });
    const imageBPath = await callImagePrompt(generate, prompts, 'generate-image', {
      topic
    });

    imageSurvivalData[imageAPath] = {
      survivalCount: 0
    };
    imageSurvivalData[imageBPath] = {
      survivalCount: 0
    };

    let currentChampionPath = imageAPath;
    let currentChallengerPath = imageBPath;

    // 3. GAME LOOP: Run for the specified number of rounds.
    while (roundNumber <= TOTAL_ROUNDS) {
      console.log(`--- Round ${roundNumber} ---`);

      // Present the two images to the user.
      await mcp.callTool({
        name: 'screens_update_screens',
        arguments: {
          screenInputs: [{
            screenId: 'game_screen',
            inputs: {
              roundNumber: roundNumber,
              imageA: currentChampionPath,
              imageB: currentChallengerPath,
            },
          }, ],
        },
      });

      // Wait for the user to choose their preferred image.
      userEventResponse = await mcp.callTool({
        name: 'screens_get_user_events',
        arguments: {},
      });
      const choiceEvent = userEventResponse.response.events[0];
      const userChoice = choiceEvent.output.choice;

      // Determine the winner of the round.
      const winnerPath = userChoice === 'A' ? currentChampionPath : currentChallengerPath;
      console.log(`User chose image ${userChoice}. Winner: ${winnerPath}`);

      // Increment the winner's survival counter.
      imageSurvivalData[winnerPath].survivalCount++;

      // The winner advances to the next round.
      currentChampionPath = winnerPath;

      // If it's not the last round, generate a new challenger.
      if (roundNumber < TOTAL_ROUNDS) {
        console.log('Generating new challenger for the next round...');
        currentChallengerPath = await callImagePrompt(generate, prompts, 'generate-image', {
          topic
        });
        // Add the new challenger to our tracking data.
        if (!imageSurvivalData[currentChallengerPath]) {
          imageSurvivalData[currentChallengerPath] = {
            survivalCount: 0
          };
        }
      }

      // Move to the next round.
      roundNumber++;
    }

    // 4. END GAME: The loop has finished.
    console.log('--- Game Over ---');

    // 5. WINNER SCREEN: Find the image that survived the most rounds.
    let finalWinnerPath = '';
    let maxSurvival = -1;

    for (const path in imageSurvivalData) {
      if (imageSurvivalData[path].survivalCount > maxSurvival) {
        maxSurvival = imageSurvivalData[path].survivalCount;
        finalWinnerPath = path;
      }
    }

    console.log(`Final winner is ${finalWinnerPath} with ${maxSurvival} wins.`);

    // Display the winner.
    await mcp.callTool({
      name: 'screens_update_screens',
      arguments: {
        screenInputs: [{
          screenId: 'winner_screen',
          inputs: {
            winnerText: `Winner! This image survived ${maxSurvival} rounds.`,
            winningImage: finalWinnerPath,
          },
        }, ],
      },
    });

    // Wait for the user to decide if they want to play again.
    userEventResponse = await mcp.callTool({
      name: 'screens_get_user_events',
      arguments: {},
    });
    const endEvent = userEventResponse.response.events[0];

    // If the user doesn't want to play again, break the main loop.
    if (endEvent.eventId !== 'play_again') {
      console.log('User chose not to play again. Exiting.');
      break;
    }

    console.log('User wants to play again. Resetting game.');
    // The `while(true)` loop will now restart the game from the beginning.
  }

  // The application will terminate after this function returns.
  return {
    parts: [{
      text: 'Thank you for playing AI Slop or Not!'
    }]
  };
}
