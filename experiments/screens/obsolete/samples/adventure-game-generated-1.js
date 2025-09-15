export default async function Invoke(capabilities) {
  const { generate, screens, console } = capabilities;

  const GEMINI_PRO = "gemini-2.5-pro";
  const GEMINI_IMAGE = "gemini-2.5-flash-image-preview";

  const state = {
    inspiration: "",
    plot: "",
    characterBio: "",
    history: [],
    lastChoices: [],
  };

  const resetState = () => {
    state.inspiration = "";
    state.plot = "";
    state.characterBio = "";
    state.history = [];
    state.lastChoices = [];
  };

  const generateAndParseJSON = async (model, prompt, history = []) => {
    try {
      const { candidates } = await generate.generateContent({
        model,
        body: {
          contents: [...history, prompt],
          generationConfig: {
            responseMimeType: "application/json",
          },
        },
      });
      const jsonText = candidates[0].content.parts[0].text;
      return JSON.parse(jsonText);
    } catch (e) {
      console.error("Failed to generate or parse JSON:", e);
      await screens.updateScreens([
        {
          screenId: "controls",
          inputs: {
            gameStatus: "An error occurred. Please try again.",
          },
        },
      ]);
      return null;
    }
  };

  const generateImage = async (prompt) => {
    try {
      const { candidates } = await generate.generateContent({
        model: GEMINI_IMAGE,
        body: {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        },
      });
      if (candidates && candidates[0].content.parts[0].fileData) {
        return candidates[0].content.parts[0].fileData.fileUri;
      }
    } catch (e) {
      console.error("Failed to generate image:", e);
    }
    return ""; // Return empty string on failure
  };

  const generatePlotAndCharacter = async () => {
    await screens.updateScreens([
      {
        screenId: "controls",
        inputs: {
          gameStatus: "Crafting your epic tale...",
        },
      },
    ]);

    const prompt = {
      role: "user",
      parts: [
        {
          text: `Generate a game story based on this inspiration: "${state.inspiration}".
        
You are a creative and engaging storyteller for a text-based adventure game. Your task is to create a compelling initial story based on a user's inspiration.

You must generate a JSON object with the following structure:
{
  "plot": "A paragraph describing the initial plotline, the world, the character's motivation, and the ultimate objective, which is called the 'boon'. The story should follow the hero's journey structure.",
  "characterBio": "A short, engaging biography of the main character, including their name, background, and personality.",
  "characterImagePrompt": "A detailed, cinematic, and visually rich text prompt suitable for an image generation model. Describe the character's appearance, clothing, gear, and the background setting. Focus on visual details. Use evocative adjectives. Style: fantasy concept art, hyperrealistic, dramatic lighting."
}`,
        },
      ],
    };

    const data = await generateAndParseJSON(GEMINI_PRO, prompt);
    if (!data) return;

    state.plot = data.plot;
    state.characterBio = data.characterBio;

    const imagePath = await generateImage(data.characterImagePrompt);
    if (!imagePath) {
      await screens.updateScreens([
        {
          screenId: "controls",
          inputs: {
            gameStatus: "Failed to create character image. Please try again.",
          },
        },
      ]);
      return;
    }

    await screens.updateScreens([
      {
        screenId: "choose_character",
        inputs: {
          bio: data.characterBio,
          picture: imagePath,
        },
      },
    ]);
    await screens.updateScreens([
      {
        screenId: "controls",
        inputs: {
          gameStatus: "A hero is born. Will you accept this destiny?",
        },
      },
    ]);
  };

  const generateNextScene = async () => {
    const systemInstruction = {
      role: "system",
      parts: [
        {
          text: `You are a master storyteller continuing a turn-based adventure game. The initial premise is: ${state.plot}. The player character's bio is: ${state.characterBio}. Based on the story so far and the user's last choice, you will generate the next scene. The game must always have a clear path for the player to progress towards achieving the original boon. The story should be engaging and the choices should be meaningful.

You must determine if the story has reached its conclusion.
- If the boon has been secured, the player has won. Generate a JSON object with this structure: \`{"isFinale": true, "finaleText": "A celebratory and descriptive paragraph concluding the story.", "finaleImagePrompt": "A detailed, cinematic prompt for the final celebratory image, capturing the moment of triumph."}\`
- Otherwise, continue the story. Generate a JSON object for the next turn with this structure: \`{"isFinale": false, "sceneText": "A brief but vivid text description of what is happening in the current scene.", "sceneImagePrompt": "A detailed, descriptive prompt for the scene's image, focusing on the environment, mood, and any key characters or objects. Style: fantasy concept art, cinematic.", "choices": ["Choice 1 text", "Choice 2 text", "Choice 3 text", "Choice 4 text"]}\`. The four choices must be distinct, actionable, and lead to different immediate outcomes.`,
        },
      ],
    };

    const conversation = [systemInstruction, ...state.history];
    const data = await generateAndParseJSON(
      GEMINI_PRO,
      conversation[conversation.length - 1],
      conversation.slice(0, -1)
    );

    if (!data) return;

    if (data.isFinale) {
      const imagePath = await generateImage(data.finaleImagePrompt);
      state.history.push({
        role: "model",
        parts: [
          {
            text: data.finaleText,
          },
        ],
      });
      await screens.updateScreens([
        {
          screenId: "finale",
          inputs: {
            image: imagePath,
            text: data.finaleText,
          },
        },
        {
          screenId: "controls",
          inputs: {
            gameStatus: "Your epic journey has reached its conclusion!",
          },
        },
      ]);
    } else {
      const imagePath = await generateImage(data.sceneImagePrompt);
      state.lastChoices = data.choices;
      state.history.push({
        role: "model",
        parts: [
          {
            text: `Scene: ${data.sceneText}\nChoices: ${data.choices.join(", ")}`,
          },
        ],
      });
      await screens.updateScreens([
        {
          screenId: "scene",
          inputs: {
            image: imagePath,
            text: data.sceneText,
            choice1: data.choices[0],
            choice2: data.choices[1],
            choice3: data.choices[2],
            choice4: data.choices[3],
          },
        },
        {
          screenId: "controls",
          inputs: {
            gameStatus: "Your turn. What will you do?",
          },
        },
      ]);
    }
  };

  // --- Event Handlers ---

  const handleStartGameEvent = async (event) => {
    if (event.eventId === "generate_inspiration") {
      await screens.updateScreens([
        {
          screenId: "controls",
          inputs: {
            gameStatus: "Generating inspiration...",
          },
        },
      ]);
      const { candidates } = await generate.generateContent({
        model: GEMINI_PRO,
        body: {
          contents: [
            {
              parts: [
                {
                  text: "Generate a short, two-to-three word, evocative inspiration for a fantasy adventure game. For example: 'Sunken City of Robots' or 'The Whispering Mountain'.",
                },
              ],
            },
          ],
        },
      });
      const generatedInspiration = candidates[0].content.parts[0].text.trim();
      await screens.updateScreens([
        {
          screenId: "start_game",
          inputs: {
            generatedInspiration,
          },
        },
        {
          screenId: "controls",
          inputs: {
            gameStatus: "Ready to start a new adventure.",
          },
        },
      ]);
    } else if (event.eventId === "start") {
      state.inspiration = event.data.inspiration;
      await generatePlotAndCharacter();
    }
  };

  const handleChooseCharacterEvent = async (event) => {
    if (event.eventId === "regenerate") {
      await generatePlotAndCharacter();
    } else if (event.eventId === "choose") {
      await screens.updateScreens([
        {
          screenId: "controls",
          inputs: {
            gameStatus: "The adventure begins...",
          },
        },
      ]);
      state.history.push({
        role: "user",
        parts: [
          {
            text: "Let the adventure begin.",
          },
        ],
      });
      await generateNextScene();
    }
  };

  const handleSceneEvent = async (event) => {
    if (event.eventId === "choose") {
      const choiceIndex = event.data.choice - 1;
      const chosenText = state.lastChoices[choiceIndex];
      state.history.push({
        role: "user",
        parts: [
          {
            text: `I choose to: ${chosenText}`,
          },
        ],
      });
      await screens.updateScreens([
        {
          screenId: "controls",
          inputs: {
            gameStatus: "The story unfolds...",
          },
        },
      ]);
      await generateNextScene();
    }
  };

  const handleFinaleEvent = async (event) => {
    if (event.eventId === "restart") {
      resetState();
      await screens.updateScreens([
        {
          screenId: "start_game",
          inputs: {},
        },
        {
          screenId: "controls",
          inputs: {
            gameStatus: "Ready to start a new adventure.",
          },
        },
      ]);
    }
  };

  const handleControlsEvent = async (event) => {
    if (event.eventId === "recap_game") {
      if (state.history.length === 0) {
        await screens.updateScreens([
          {
            screenId: "game_recap",
            inputs: {
              recap: "# Your adventure hasn't started yet!",
            },
          },
        ]);
        return;
      }

      await screens.updateScreens([
        {
          screenId: "controls",
          inputs: {
            gameStatus: "Recalling your journey...",
          },
        },
      ]);
      const { candidates } = await generate.generateContent({
        model: GEMINI_PRO,
        body: {
          contents: [
            ...state.history,
            {
              role: "user",
              parts: [
                {
                  text: "Based on the provided game history, write a concise summary of my journey so far in markdown format.",
                },
              ],
            },
          ],
        },
      });
      const recapText = candidates[0].content.parts[0].text;
      await screens.updateScreens([
        {
          screenId: "game_recap",
          inputs: {
            recap: recapText,
          },
        },
        {
          screenId: "controls",
          inputs: {
            gameStatus: "Your turn. What will you do?",
          },
        },
      ]);
    }
  };

  // --- Main Application Logic ---

  await screens.updateScreens([
    {
      screenId: "start_game",
      inputs: {},
    },
    {
      screenId: "controls",
      inputs: {
        gameStatus: "Ready to start a new adventure.",
      },
    },
  ]);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { events } = await screens.getUserEvents();
    for (const event of events) {
      switch (event.screenId) {
        case "start_game":
          await handleStartGameEvent(event);
          break;
        case "choose_character":
          await handleChooseCharacterEvent(event);
          break;
        case "scene":
          await handleSceneEvent(event);
          break;
        case "finale":
          await handleFinaleEvent(event);
          break;
        case "controls":
          await handleControlsEvent(event);
          break;
        default:
          console.log(`Unknown event from screen: ${event.screenId}`);
      }
    }
  }
}
