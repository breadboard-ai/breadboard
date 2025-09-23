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

export default async function (capabilities) {
  const { mcp, console, generate, prompts } = capabilities;

  // Game state to hold the story, character, and player history
  let gameState = {
    plot: "",
    characterBio: "",
    characterImagePrompt: "",
    history: [],
    currentSceneText: "",
    currentChoices: [],
  };

  /**
   * Helper function to update a single screen.
   * @param {string} screenId The ID of the screen to update.
   * @param {object} inputs The input data for the screen.
   */
  const updateScreen = async (screenId, inputs) => {
    await mcp.callTool({
      name: "screens_update_screens",
      arguments: {
        screenInputs: [{ screenId, inputs }],
      },
    });
  };

  /**
   * Resets the game state and displays the initial start screen.
   */
  const showStartScreen = async () => {
    gameState = {
      plot: "",
      characterBio: "",
      characterImagePrompt: "",
      history: [],
      currentSceneText: "",
      currentChoices: [],
    };
    await updateScreen("start_game", {});
    await updateScreen("controls", { gameStatus: "Ready to begin" });
  };

  /**
   * Handles the initial game setup after the user provides inspiration.
   * @param {string} inspiration The user's inspiration for the game.
   */
  async function handleStartGame(inspiration) {
    await updateScreen("controls", {
      gameStatus: "Generating your adventure...",
    });
    const { plot, characterBio, characterImagePrompt } = await callJsonPrompt(
      generate,
      prompts,
      "generate-plot-and-character",
      { inspiration }
    );

    gameState.plot = plot;
    gameState.characterBio = characterBio;
    gameState.characterImagePrompt = characterImagePrompt;

    const picture = await callImagePrompt(
      generate,
      prompts,
      "generate-character-portrait",
      { characterDescription: characterImagePrompt }
    );

    await updateScreen("choose_character", { bio: characterBio, picture });
    await updateScreen("controls", { gameStatus: "Choose your character" });
  }

  /**
   * Handles the user's request to regenerate the character.
   */
  async function handleRegenerateCharacter() {
    await updateScreen("controls", { gameStatus: "Regenerating character..." });
    const { characterBio, characterImagePrompt } = await callJsonPrompt(
      generate,
      prompts,
      "regenerate-character",
      { plot: gameState.plot }
    );

    gameState.characterBio = characterBio;
    gameState.characterImagePrompt = characterImagePrompt;

    const picture = await callImagePrompt(
      generate,
      prompts,
      "generate-character-portrait",
      { characterDescription: characterImagePrompt }
    );

    await updateScreen("choose_character", { bio: characterBio, picture });
    await updateScreen("controls", { gameStatus: "Choose your character" });
  }

  /**
   * Generates and displays the next scene in the game.
   */
  async function handleNewTurn() {
    await updateScreen("controls", { gameStatus: "Generating next turn..." });

    const historyString =
      gameState.history.length > 0
        ? gameState.history.map((h, i) => `${i + 1}. ${h}`).join("\n")
        : "No actions taken yet.";

    const { sceneText, sceneImagePrompt, choices } = await callJsonPrompt(
      generate,
      prompts,
      "generate-next-turn",
      {
        plot: gameState.plot,
        bio: gameState.characterBio,
        history: historyString,
      }
    );

    gameState.currentSceneText = sceneText;
    gameState.currentChoices = choices;

    const image = await callImagePrompt(
      generate,
      prompts,
      "generate-scene-image",
      {
        characterDescription: gameState.characterImagePrompt,
        sceneDescription: sceneImagePrompt,
      }
    );

    await updateScreen("scene", {
      image,
      text: sceneText,
      choice1: choices[0],
      choice2: choices[1],
      choice3: choices[2],
      choice4: choices[3],
    });
    await updateScreen("controls", { gameStatus: "Your turn" });
  }

  /**
   * Processes the player's choice, updates the plot, and determines the next step.
   * @param {number} choiceIndex The 1-based index of the player's choice.
   */
  async function handlePlayerChoice(choiceIndex) {
    await updateScreen("controls", { gameStatus: "Processing your choice..." });

    const choiceText = gameState.currentChoices[choiceIndex - 1];
    gameState.history.push(choiceText);

    const { updatedPlot, boonSecured } = await callJsonPrompt(
      generate,
      prompts,
      "update-plot-based-on-choice",
      {
        plot: gameState.plot,
        currentScene: gameState.currentSceneText,
        choice: choiceText,
      }
    );

    gameState.plot = updatedPlot;

    if (boonSecured) {
      await handleFinale();
    } else {
      await handleNewTurn();
    }
  }

  /**
   * Generates and displays the final, celebratory scene of the game.
   */
  async function handleFinale() {
    await updateScreen("controls", {
      gameStatus: "Generating the grand finale...",
    });

    const { finaleText, finaleImagePrompt } = await callJsonPrompt(
      generate,
      prompts,
      "generate-finale",
      {
        plot: gameState.plot,
        bio: gameState.characterBio,
      }
    );

    const image = await callImagePrompt(
      generate,
      prompts,
      "generate-scene-image",
      {
        characterDescription: gameState.characterImagePrompt,
        sceneDescription: finaleImagePrompt,
      }
    );

    await updateScreen("finale", { image, text: finaleText });
    await updateScreen("controls", { gameStatus: "Congratulations!" });
  }

  /**
   * Displays a recap of the player's journey so far.
   */
  async function handleRecap() {
    const recapText =
      gameState.history.length > 0
        ? `**Your Story So Far:**\n\n` +
          gameState.history
            .map(
              (h, i) =>
                `${i + 1}. You chose to ${h.charAt(0).toLowerCase() + h.slice(1)}`
            )
            .join("\n")
        : "Your adventure has just begun! No choices have been made yet.";

    await updateScreen("game_recap", { recap: recapText });
  }

  // Initial call to set up the game
  await showStartScreen();

  // Main game loop to process user events
  while (true) {
    const { response, isError } = await mcp.callTool({
      name: "screens_get_user_events",
    });

    if (isError || !response || !response.events) {
      console.error("Error getting user events.");
      continue;
    }

    for (const event of response.events) {
      const { screenId, eventId, output } = event;

      switch (screenId) {
        case "start_game":
          if (eventId === "generate_inspiration") {
            await updateScreen("controls", {
              gameStatus: "Generating inspiration...",
            });
            const inspiration = await callTextPrompt(
              generate,
              prompts,
              "generate-inspiration"
            );
            await updateScreen("start_game", {
              generatedInspiration: inspiration,
            });
            await updateScreen("controls", { gameStatus: "Ready to begin" });
          } else if (eventId === "start") {
            await handleStartGame(output.inspiration);
          }
          break;

        case "choose_character":
          if (eventId === "regenerate") {
            await handleRegenerateCharacter();
          } else if (eventId === "choose") {
            await handleNewTurn();
          }
          break;

        case "scene":
          if (eventId === "choose") {
            await handlePlayerChoice(output.choice);
          }
          break;

        case "finale":
          if (eventId === "restart") {
            await showStartScreen();
          }
          break;

        case "controls":
          if (eventId === "recap_game") {
            await handleRecap();
          }
          break;
      }
    }
  }
}
