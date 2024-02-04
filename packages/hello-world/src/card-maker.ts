/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { gemini } from "@google-labs/gemini-kit";

// A URL of the Gemini Pro Vision board. We will invoke this board to
// describe the picture.
// Has these inputs:
// - `parts`: the Gemini Pro API parts structure (JSON),
// Has these outputs:
// -  `result`: Gemini Pro Vision's response
const visionBoard =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/f4adabe69a5a9af73a29fcc72e7042404157717b/packages/breadboard-web/public/graphs/gemini-pro-vision.json";

// A node that appends the prompt to the parts array that already contains
// the picture.
// Note, this one is a bit "in the weeds": it literally formats the Gemini Pro
// API request to include the picture as part of the prompt.
const appender = code(({ part, prompt }) => {
  const parts = Array.isArray(part) ? part : [part];
  return { parts: [...parts, { text: prompt }] };
});

// A node type that generates a random letter.
const randomLetterMaker = code(() => {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return { letter };
});

// The board we're building.
export default await board(({ drawing }) => {
  // [Step 1]
  // Tell the input that it's drawable.
  drawing
    .isImage()
    .title("Draw an object to transform into the mystical creature")
    .format("drawable"); // can also be "webcam".

  // [Added last]
  // Gemini tends to overrotate on Wumpuses for some reason,
  // so we need a way to give it some randomness to be more creative with names.
  // Let's ask it to generate a name that starts with a random letter.
  const { letter } = randomLetterMaker({ $id: "makeRandomLetter" });

  // [Step 3]
  // Append the picture to the prompt.
  const { parts } = appender({
    $id: "appendPictureToPrompt",
    part: drawing,
    prompt: `Describe the pictured object or subject in the sketch above, provide a thorough list of details. No matter how simple the sketch is, try
     to come up with as many details as possible. Improvise if necessary.`,
  });

  // [Step 2]
  // Ask Gemini Pro Vision to describe the picture.
  const describePicture = core.invoke({
    $id: "describePicture",
    path: visionBoard,
    parts,
  });

  // [Step 3]
  // Create a prompt for the Character Developer, who will transform the
  // mundane description of the picture into a mystical creature.
  const { prompt } = templates.promptTemplate({
    $id: "characterDeveloperTemplate",
    template: `You are an expert board game character developer.

    Read the description below and transform it into a mystical creature with unique abilities.

    Come up with a fun name for the creature and a backstory for how it came to be. The name must start with the letter "{{letter}}".
    
    Write a story of the creature and how it came to be. Describe its unique abilities. Provide the list of attributes (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma) and their scores as a bulleted list.

    Reply in valid Markdown format with the following headings: "NAME", "STORY", "ABILITIES", and "ATTRIBUTES".
    
    ## DESCRIPTION:
    {{description}}
    
    ## RESPONSE:
    `,
    description: describePicture.result,
    letter,
  });

  // [Step 4]
  // Ask Gemini Pro to act as the Character Developer.
  const developCharacter = gemini.text({
    $id: "developCharacter",
    // While Breadboard TypeScript type system is under development,
    // we occasionally need to remind it what type of port input we're
    // expecting. That's what the `isString()` method does here.
    // It's a temporary workaround, and will go away once we have tighter
    // typing support.
    text: prompt.isString(),
  });

  // Return the results: both the newly minted card, and the original
  // picture description, so that we can marvel at the transformation.
  return {
    card: developCharacter.text.title("Game Card"),
    description: describePicture.result.title("Picture description"),
  };
}).serialize({
  title: "Card Maker",
  description: "Creates a board game card of a mystical creature that you draw",
  version: "0.0.1",
});
