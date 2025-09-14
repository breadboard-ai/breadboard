export default async ({ generate, screens, console }) => {
  const GEMINI_TEXT_MODEL = "gemini-2.5-pro";
  const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image-preview";

  // Helper function to call Gemini for text generation
  const callGeminiText = async (prompt, jsonSchema = null) => {
    const args = {
      model: GEMINI_TEXT_MODEL,
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
        generationConfig: {},
      },
    };
    if (jsonSchema) {
      args.body.generationConfig.responseMimeType = "application/json";
      args.body.generationConfig.responseSchema = jsonSchema;
    }

    const { candidates } = await generate.generateContent(args);
    const part = candidates[0].content.parts[0];
    if (part.text) {
      return jsonSchema ? JSON.parse(part.text) : part.text;
    }
    console.error("Gemini text generation failed to return text.", part);
    return null;
  };

  // Helper function to generate an image
  const generateImage = async (prompt) => {
    const { candidates } = await generate.generateContent({
      model: GEMINI_IMAGE_MODEL,
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
    if (
      candidates &&
      candidates.length > 0 &&
      candidates[0].content &&
      candidates[0].content.parts.length > 0
    ) {
      const filePart = candidates[0].content.parts[0].fileData;
      if (filePart) {
        return filePart.fileUri;
      }
    }
    console.error("Image generation failed. Response:", candidates);
    // Return a placeholder or handle the error appropriately
    return "";
  };

  // Helper to update the game status on the controls screen
  const updateStatus = async (text) => {
    await screens.updateScreens([
      {
        screenId: "controls",
        inputs: {
          gameStatus: text,
        },
      },
    ]);
  };

  // Main game loop allowing for restarts
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let gameState = {
      inspiration: "",
      character: {
        bio: "",
        imagePrompt: "",
      },
      plotHistory: [],
      boon: "",
      lastChoice: "The adventure begins!",
    };

    // 1. START SCREEN
    await screens.updateScreens([
      {
        screenId: "start_game",
        inputs: {},
      },
    ]);
    await updateStatus("Ready for an adventure?");

    let inspiration = null;
    while (!inspiration) {
      const { events } = await screens.getUserEvents();
      const event = events[0];

      if (event.screenId === "start_game") {
        if (event.eventId === "generate_inspiration") {
          await updateStatus("Generating inspiration...");
          const inspirationPrompt =
            "Generate a one-sentence inspiration for a fantasy adventure game. For example: 'A fallen star that holds the key to eternal winter.' or 'The last dragon's egg, hidden in a forgotten city.'";
          const generatedInspiration = await callGeminiText(inspirationPrompt);
          await screens.updateScreens([
            {
              screenId: "start_game",
              inputs: {
                generatedInspiration,
              },
            },
          ]);
          await updateStatus("Ready for an adventure?");
        } else if (event.eventId === "start") {
          if (event.data.inspiration && `${event.data.inspiration}`.trim()) {
            inspiration = event.data.inspiration;
          }
        }
      }
    }
    gameState.inspiration = inspiration;

    // 2. PLOT & CHARACTER GENERATION
    await updateStatus("Creating your story...");
    const plotSchema = {
      type: "object",
      properties: {
        character_bio: {
          type: "string",
          description: "A short, intriguing backstory for the main character.",
        },
        story_premise: {
          type: "string",
          description:
            "A summary of the world, the conflict, and the call to adventure.",
        },
        boon: {
          type: "string",
          description: "The ultimate goal or object the hero seeks.",
        },
        initial_scene: {
          type: "string",
          description:
            "A description of the very first scene where the game begins.",
        },
      },
      required: ["character_bio", "story_premise", "boon", "initial_scene"],
    };
    const plotPrompt = `Based on the inspiration "${gameState.inspiration}", create a compelling story for a turn-based adventure game. The story should follow the hero's journey structure. Your output must be a JSON object conforming to the provided schema.`;
    const initialPlot = await callGeminiText(plotPrompt, plotSchema);
    gameState.character.bio = initialPlot.character_bio;
    gameState.boon = initialPlot.boon;
    gameState.plotHistory.push(
      initialPlot.story_premise,
      initialPlot.initial_scene
    );

    // 3. CHARACTER SELECTION LOOP
    let characterAccepted = false;
    while (!characterAccepted) {
      await updateStatus("Generating your character...");
      const imagePromptGenPrompt = `Based on the following character bio, create a highly detailed image generation prompt for a character portrait. The prompt should describe the character's appearance, clothing, expression, and the style of the image (e.g., "digital painting, fantasy, detailed, cinematic lighting, vibrant colors"). Character Bio: ${gameState.character.bio}`;
      gameState.character.imagePrompt =
        await callGeminiText(imagePromptGenPrompt);
      const characterPictureVfsPath = await generateImage(
        gameState.character.imagePrompt
      );

      await screens.updateScreens([
        {
          screenId: "choose_character",
          inputs: {
            bio: gameState.character.bio,
            picture: characterPictureVfsPath,
          },
        },
      ]);
      await updateStatus("Will you accept this hero?");

      const { events } = await screens.getUserEvents();
      const event = events[0];

      if (event.screenId === "choose_character") {
        if (event.eventId === "choose") {
          characterAccepted = true;
        } else if (event.eventId === "regenerate") {
          await updateStatus("Let's try someone new...");
          const regenBioPrompt = `The player rejected the last character. Based on the same story premise ("${initialPlot.story_premise}"), create a new, different character bio.`;
          gameState.character.bio = await callGeminiText(regenBioPrompt);
        }
      }
    }

    // 4. MAIN GAMEPLAY LOOP
    let isFinale = false;
    let currentChoices = [];
    while (!isFinale) {
      await updateStatus("Generating the next scene...");
      const sceneSchema = {
        type: "object",
        properties: {
          scene_description: {
            type: "string",
            description:
              "A brief paragraph describing the current situation, continuing from the last action.",
          },
          image_prompt: {
            type: "string",
            description:
              "A detailed prompt for an image generator to create the scene's illustration.",
          },
          choices: {
            type: "array",
            items: {
              type: "string",
            },
            minItems: 4,
            maxItems: 4,
            description:
              "Four distinct, short, action-oriented strings for the player's next move.",
          },
          is_finale: {
            type: "boolean",
            description:
              "Set to true only if the player has definitively achieved the boon, false otherwise.",
          },
        },
        required: ["scene_description", "image_prompt", "choices", "is_finale"],
      };
      const storySoFar = gameState.plotHistory.join("\n\n");
      const scenePrompt = `You are the Dungeon Master. Continue the story.
                Story So Far: ${storySoFar}
                Character: ${gameState.character.bio}
                Goal (The Boon): ${gameState.boon}
                Player's Last Action: "${gameState.lastChoice}"
                
                Generate the next scene. Ensure the story always provides a path to achieving the boon. Your output must be a JSON object conforming to the provided schema.`;

      const sceneData = await callGeminiText(scenePrompt, sceneSchema);
      isFinale = sceneData.is_finale;
      currentChoices = sceneData.choices;

      if (isFinale) {
        // Break the loop to proceed to the finale screen generation
        break;
      }

      const sceneImageVfsPath = await generateImage(sceneData.image_prompt);
      gameState.plotHistory.push(sceneData.scene_description);

      await screens.updateScreens([
        {
          screenId: "scene",
          inputs: {
            image: sceneImageVfsPath,
            text: sceneData.scene_description,
            choice1: currentChoices[0],
            choice2: currentChoices[1],
            choice3: currentChoices[2],
            choice4: currentChoices[3],
          },
        },
      ]);
      await updateStatus("What will you do next?");

      let choiceMade = false;
      while (!choiceMade) {
        const { events } = await screens.getUserEvents();
        const event = events[0];

        if (event.screenId === "scene" && event.eventId === "choose") {
          const choiceIndex = event.data.choice - 1;
          gameState.lastChoice = currentChoices[choiceIndex];
          choiceMade = true;
        } else if (
          event.screenId === "controls" &&
          event.eventId === "recap_game"
        ) {
          const recapText = `Your quest to find the ${gameState.boon}.\n\n--- YOUR STORY ---\n\n${gameState.plotHistory.join("\n\n")}`;
          await screens.updateScreens([
            {
              screenId: "game_recap",
              inputs: {
                recap: recapText,
              },
            },
          ]);
        }
      }
    }

    // 5. FINALE
    await updateStatus("Reaching the grand finale...");
    const finaleSchema = {
      type: "object",
      properties: {
        finale_text: {
          type: "string",
          description:
            "A celebratory paragraph describing the triumphant final scene.",
        },
        image_prompt: {
          type: "string",
          description:
            "A detailed prompt for an image generator to create an epic illustration of this final scene.",
        },
      },
      required: ["finale_text", "image_prompt"],
    };
    const storySoFar = gameState.plotHistory.join("\n\n");
    const finalePrompt = `The story has concluded. The player has achieved their goal.
            Story: ${storySoFar}
            Character: ${gameState.character.bio}
            Goal (The Boon): ${gameState.boon}
            Player's final, successful action was: "${gameState.lastChoice}"
            
            Write the celebratory conclusion. Your output must be a JSON object conforming to the provided schema.`;

    const finaleData = await callGeminiText(finalePrompt, finaleSchema);
    const finaleImageVfsPath = await generateImage(finaleData.image_prompt);

    await screens.updateScreens([
      {
        screenId: "finale",
        inputs: {
          image: finaleImageVfsPath,
          text: finaleData.finale_text,
        },
      },
    ]);
    await updateStatus("Congratulations, you have won!");

    let wantsToRestart = false;
    while (!wantsToRestart) {
      const { events } = await screens.getUserEvents();
      const event = events[0];
      if (event.screenId === "finale" && event.eventId === "restart") {
        wantsToRestart = true;
      }
    }
  }
};
