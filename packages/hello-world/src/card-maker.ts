/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { gemini } from "@google-labs/gemini-kit";

// A URL of the Webcam board. We will invoke this board to get the picture to
// describe. The board source is located here:
// https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard-web/src/boards/webcam.ts
// Has these inputs:
// - `picture`: the picture from the webcam (image),
// - `prompt`: the prompt to use with the picture (string).
// Has these outputs:
// - `text`: the description of the picture.
const webcamBoard =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/5c3076a500f692c60bd5cfd0b25e92190f17c12e/packages/breadboard-web/public/graphs/webcam.json";

// A node type that generates a random letter.
const randomLetterMaker = code(() => {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return { letter };
});

// The board we're building.
export default await board(({ drawing }) => {
  // Tell the input that it's drawable.
  drawing
    .isImage()
    .title("Draw an object to transform into the mystical creature")
    .format("drawable"); // can also be "webcam".

  // Gemini tends to overrotate on Wumpuses for some reason,
  // so we need a way to give it some randomness to be more creative with names.
  // Let's ask it to generate a name that starts with a random letter.
  const { letter } = randomLetterMaker({ $id: "makeRandomLetter" });

  // Ask Gemini Pro Vision to describe the picture.
  const describePicture = core.invoke({
    $id: "describePicture",
    path: webcamBoard,
    picture: drawing,
    prompt:
      "Describe the pictured object or subject in the sketch above, provide a thorough list of details. No matter how simple the sketch is, try to come up with as many details as possible. Improvise if necessary.",
  });

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
    description: describePicture.text,
    letter,
  });

  // Ask Gemini Pro to act as the Character Developer.
  const developCharacter = gemini.text({
    $id: "developCharacter",
    text: prompt,
  });

  // Return the results: both the newly minted card, and the original
  // picture description, so that we can marvel at the transformation.
  return {
    card: developCharacter.text.title("Game Card"),
    description: describePicture.text.title("Picture description"),
  };
}).serialize({
  title: "Card Maker",
  description: "Creates a board game card of a mystical creature that you draw",
  version: "0.0.1",
});
