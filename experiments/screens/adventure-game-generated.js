/**
 * A helper function to call the Gemini API and get a structured JSON response.
 * @param {import("./types").Gemini} generate - The Gemini generate function.
 * @param {string} systemInstruction - The system instruction for the model.
 * @param {string} userPrompt - The user prompt for the model.
 * @param {import("./types").Schema} schema - The JSON schema for the response.
 * @returns {Promise<object>} - The parsed JSON object from the model's response.
 */
async function generateJson(generate, systemInstruction, userPrompt, schema) {
  const response = await generate.generateContent({
    model: "gemini-2.5-pro",
    systemInstruction: { parts: [{ text: systemInstruction }] },
    body: {
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (part?.text) {
    try {
      return JSON.parse(part.text);
    } catch (e) {
      throw new Error(`Failed to parse JSON: ${e}`);
    }
  }
  throw new Error("JSON generation failed or returned empty response.");
}

/**
 * A helper function to generate an image from a text prompt.
 * @param {import("./types").Gemini} generate - The Gemini generate function.
 * @param {string} prompt - The detailed text prompt for the image.
 * @returns {Promise<string>} - A data URI for the generated image.
 */
async function generateImageFromPrompt(generate, prompt) {
  const response = await generate.generateContent({
    model: "gemini-2.5-flash-image-preview",
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseModalities: ["IMAGE"],
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (part?.inlineData) {
    const { data, mimeType } = part.inlineData;
    return `data:${mimeType};base64,${data}`;
  }
  throw new Error("Image generation failed or returned empty response.");
}

/**
 * Handles the initial state of the game, where the user provides inspiration.
 * @param {import("./types").Capabilities} capabilities
 * @param {object} gameState
 * @returns {Promise<string>} The next state for the state machine.
 */
async function handleStartState(capabilities, gameState) {
  await capabilities.screens.updateScreens([
    {
      screenId: "start_game",
      inputs: {
        generatedInspiration: gameState.generatedInspiration || "",
      },
    },
    {
      screenId: "controls",
      inputs: { gameStatus: "Provide an inspiration to begin." },
    },
  ]);

  const { events } = await capabilities.screens.getUserEvents();
  const event = events[0];

  if (event.eventId === "generate_inspiration") {
    await capabilities.screens.updateScreens([
      {
        screenId: "controls",
        inputs: { gameStatus: "Generating inspiration..." },
      },
    ]);
    const response = await capabilities.generate.generateContent({
      model: "gemini-2.5-flash",
      body: {
        contents: [
          {
            parts: [
              {
                text: "Generate a single, short, intriguing inspiration for a fantasy turn-based adventure game. For example: 'A cartographer whose maps can alter reality' or 'A chef seeking a mythical ingredient guarded by a dragon'.",
              },
            ],
          },
        ],
      },
    });
    gameState.generatedInspiration =
      response.candidates[0].content.parts[0].text;
    return "START";
  }

  if (event.eventId === "start" && event.data.inspiration) {
    gameState.inspiration = event.data.inspiration;
    gameState.history = [];
    return "CREATE_CHARACTER";
  }

  return "START";
}

/**
 * Handles the character creation state.
 * @param {import("./types").Capabilities} capabilities
 * @param {object} gameState
 * @returns {Promise<string>} The next state for the state machine.
 */
async function handleCreateCharacterState(capabilities, gameState) {
  await capabilities.screens.updateScreens([
    { screenId: "controls", inputs: { gameStatus: "Generating character..." } },
  ]);

  const schema = {
    type: "object",
    properties: {
      characterName: { type: "string" },
      characterBio: { type: "string" },
      characterImagePrompt: { type: "string" },
      initialPlot: { type: "string" },
      objective: { type: "string" },
    },
    required: [
      "characterName",
      "characterBio",
      "characterImagePrompt",
      "initialPlot",
      "objective",
    ],
  };
  const systemInstruction =
    "You are a creative storyteller. Generate the initial setup for a turn-based adventure game based on a user's inspiration. Respond with a valid JSON object.";
  const userPrompt = `The inspiration is: "${gameState.inspiration}". Generate the character, initial plot, and objective. The image prompt should be detailed and vivid for a fantasy character portrait.`;

  const plotData = await generateJson(
    capabilities.generate,
    systemInstruction,
    userPrompt,
    schema
  );

  const characterImage = await generateImageFromPrompt(
    capabilities.generate,
    plotData.characterImagePrompt
  );

  await capabilities.screens.updateScreens([
    {
      screenId: "choose_character",
      inputs: {
        bio: plotData.characterBio,
        picture: characterImage,
      },
    },
    {
      screenId: "controls",
      inputs: { gameStatus: "Do you want to play as this character?" },
    },
  ]);

  const { events } = await capabilities.screens.getUserEvents();
  const event = events[0];

  if (event.eventId === "choose") {
    gameState.character = {
      name: plotData.characterName,
      bio: plotData.characterBio,
    };
    gameState.objective = plotData.objective;
    gameState.history.push(plotData.initialPlot);
    gameState.lastChoiceText = "begin their adventure";
    return "GAME_TURN";
  }

  // 'regenerate' or any other event will cause a loop
  return "CREATE_CHARACTER";
}

/**
 * Handles the main game loop, generating and presenting scenes.
 * @param {import("./types").Capabilities} capabilities
 * @param {object} gameState
 * @returns {Promise<string>} The next state for the state machine.
 */
async function handleGameTurnState(capabilities, gameState) {
  await capabilities.screens.updateScreens([
    {
      screenId: "controls",
      inputs: { gameStatus: "Generating next scene..." },
    },
  ]);

  const schema = {
    type: "object",
    properties: {
      sceneDescription: { type: "string" },
      sceneImagePrompt: { type: "string" },
      choices: {
        type: "array",
        items: { type: "string" },
        minItems: 4,
        maxItems: 4,
      },
      updatedStory: { type: "string" },
      isBoonSecured: { type: "boolean" },
    },
    required: [
      "sceneDescription",
      "sceneImagePrompt",
      "choices",
      "updatedStory",
      "isBoonSecured",
    ],
  };
  const systemInstruction =
    "You are a game master for a fantasy adventure game. Based on the story so far and the player's last choice, generate the next scene. The story must progress towards the player's objective. After 3-5 turns, guide the story to a conclusion where the boon can be secured. Respond with a valid JSON object.";
  const userPrompt = `This is the story so far:\n${gameState.history.join(
    "\n\n"
  )}\n\nThe player's objective is: "${
    gameState.objective
  }".\n\nThe player just chose to: "${
    gameState.lastChoiceText
  }".\n\nNow, generate the next scene. If the objective is met in this scene, set isBoonSecured to true.`;

  const sceneData = await generateJson(
    capabilities.generate,
    systemInstruction,
    userPrompt,
    schema
  );

  const sceneImage = await generateImageFromPrompt(
    capabilities.generate,
    sceneData.sceneImagePrompt
  );

  gameState.history.push(sceneData.updatedStory);

  if (sceneData.isBoonSecured) {
    gameState.finalSceneData = sceneData;
    return "FINALE";
  }

  await capabilities.screens.updateScreens([
    {
      screenId: "scene",
      inputs: {
        image: sceneImage,
        text: sceneData.sceneDescription,
        choice1: sceneData.choices[0],
        choice2: sceneData.choices[1],
        choice3: sceneData.choices[2],
        choice4: sceneData.choices[3],
      },
    },
    { screenId: "controls", inputs: { gameStatus: "What will you do next?" } },
  ]);

  const { events } = await capabilities.screens.getUserEvents();
  const event = events[0];

  if (event.eventId === "choose") {
    const choiceIndex = event.data.choice - 1;
    gameState.lastChoiceText = sceneData.choices[choiceIndex];
    return "GAME_TURN";
  }

  return "GAME_TURN";
}

/**
 * Handles the final state of the game after the boon is secured.
 * @param {import("./types").Capabilities} capabilities
 * @param {object} gameState
 * @returns {Promise<string>} The next state for the state machine.
 */
async function handleFinaleState(capabilities, gameState) {
  await capabilities.screens.updateScreens([
    {
      screenId: "controls",
      inputs: { gameStatus: "Generating the finale..." },
    },
  ]);

  const schema = {
    type: "object",
    properties: {
      finaleDescription: { type: "string" },
      finaleImagePrompt: { type: "string" },
    },
    required: ["finaleDescription", "finaleImagePrompt"],
  };

  const systemInstruction =
    "You are a narrator concluding an adventure game. The player has won. Describe the final, triumphant scene based on the story.";
  const userPrompt = `The story is:\n${gameState.history.join(
    "\n\n"
  )}\nThe player has secured the boon: "${
    gameState.objective
  }". Describe the final scene in a celebratory tone.`;

  const finaleData = await generateJson(
    capabilities.generate,
    systemInstruction,
    userPrompt,
    schema
  );

  const finaleImage = await generateImageFromPrompt(
    capabilities.generate,
    finaleData.finaleImagePrompt
  );

  await capabilities.screens.updateScreens([
    {
      screenId: "finale",
      inputs: {
        image: finaleImage,
        text: finaleData.finaleDescription,
      },
    },
    {
      screenId: "controls",
      inputs: { gameStatus: "Congratulations! You won!" },
    },
  ]);

  const { events } = await capabilities.screens.getUserEvents();
  if (events[0]?.eventId === "restart") {
    // Reset gameState for a new game
    Object.keys(gameState).forEach((key) => delete gameState[key]);
    return "START";
  }

  return "FINALE"; // Stay in finale until restart
}

/**
 * The main entry point for the turn-based adventure game.
 * @param {import("./types").Capabilities} capabilities
 * @returns {Promise<import("./types").ContentBlock[]>}
 */
export default async function Invoke(capabilities) {
  let state = "START";
  const gameState = {};

  // eslint-disable-next-line no-constant-condition
  while (true) {
    switch (state) {
      case "START":
        state = await handleStartState(capabilities, gameState);
        break;
      case "CREATE_CHARACTER":
        state = await handleCreateCharacterState(capabilities, gameState);
        break;
      case "GAME_TURN":
        state = await handleGameTurnState(capabilities, gameState);
        break;
      case "FINALE":
        state = await handleFinaleState(capabilities, gameState);
        break;
      default:
        capabilities.console.error("Unknown game state:", state);
        return [];
    }
  }
}
