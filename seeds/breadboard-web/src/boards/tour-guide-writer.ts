/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { Core } from "@google-labs/core-kit";
import { PaLMKit } from "@google-labs/palm-kit";

const board = new Board({
  title: "Tour Guide Writer",
  description:
    "This boards attempts to write a tour guide for a specified location.",
  version: "0.0.1",
});
const starter = board.addKit(Starter);
const core = board.addKit(Core);
const palm = board.addKit(PaLMKit);

const location = board.input({
  $id: "location",
  schema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        title: "Location",
        description: "The location for which to write a tour guide",
      },
    },
  },
});

const output = board.output({
  $id: "guide",
  schema: {
    type: "object",
    properties: {
      guide: {
        type: "string",
        title: "Guide",
        description: "The tour guide for the specified location",
      },
    },
  },
});

const travelItineraryTemplate = starter.promptTemplate(
  `[Place] Seattle, WA
[Top ten place-based experiences with no duplicates]
1) See the city from the Space Needle
2) Watch the fish throwing at Pike Place Market
3) Add chewing gum to the The Gum Wall
4) Stroll the Chihuly Garden and Glass Museum
5) Take a selfie with the Fremont Troll
6) Walk the quad at the University of Washington
7) Watch the octopus feeding at the Seattle Aquarium
8) Learn about aviation history at the Museum of Flight
9) Wander the art at the Seattle Art Museum
10) See the baby gorilla at the Woodland Park Zoo

[Place] Madrid, Spain
[Top ten place-based experiences with no duplicates]
1) Stroll the Gran Via
2) See the Prado Museum
3) Attend a Real Madrid game
4) Stroll through the Mercado de San Miguel
5) Sip wine at the Bodega de Palacio
6) Go clubbing at the Chueca district
7) Shop at the El Rastro flea market
8) Take a selfie at the Puerta del Sol
9) Shop at the El Corte Ingles
10) Enjoy tapas and wine at La Latina

[Place] Chicago, IL
[Top ten place-based experiences with no duplicates] 
1) Attend a Chicago Bulls game
2) Stroll the Magnificent Mile
3) Go to a museum at the Museum of Science and Industry
4) Stroll the Millennium Park
5) Visit the Willis Tower
6) See the Chicago River
7) Take a selfie at the Bean
8) Eat deep dish pizza at Giordano's
9) Shop at the Water Tower Place
10) See the Chicago Theatre

[Place] {{location}}
[Top ten place-based experiences with no duplicates]
`,
  { $id: "travelItinerary" }
);

const travelItineraryGenerator = palm
  .generateText({
    $id: "travelItineraryGenerator",
    stopSequences: ["\n[Place]"],
  })
  .wire("<-PALM_KEY", starter.secrets({ keys: ["PALM_KEY"] }));

const splitItinerary = starter.runJavascript("split", {
  $id: "splitItinerary",
  code: function split({ itinerary }: { itinerary: string }) {
    return itinerary
      .split(/[0-9]{1,2}\)/)
      .map((e) => e.trim())
      .filter((e) => e !== "");
  }.toString(),
});

// This the magic sauce. The `map` node takes in a  `list` input property, which
// must be an array of objects (strings, in this case).
// It then runs a sub-graph defined below for each item in the supplied list.
const createGuides = core.map((board, input, output) => {
  const starter = board.addKit(Starter);
  const palm = board.addKit(PaLMKit);

  const guideTemplate = starter.promptTemplate(
    `[City] Paris, France
  [Activity] Have a picnic in the Luxembourg Gardens
  [Experiential story] Grab a baguette, some cheese and bottle of wine and head over to Luxembourg Gardens. You'll enjoy an even stroll, a great chance to people watch, and a charming free evening that is quintessentially Parisian.
  
  [City] Madrid, Spain
  [Activity] See the Prado Museum
  [Experiential story] The Prado is an art lover's paradise. It is home to the largest collection of works by Goya, Velazquez, and El Greco. There are also works by Picasso, Monet, and Rembrandt. The Prado is a must-see for anyone visiting Madrid.
  
  [City] Tatooine
  [Activity] Catch a pod race
  [Experiential story] A pod race is a race of flying engines called pods. Pod racing is a dangerous sport and was very popular in the Outer Rim Territories before the Empire was formed.
  
  
  [City] {{location}}
  [Activity] {{activity}}
  [Experiential story]
  `,
    { $id: "guideTemplate" }
  );

  const guideGenerator = palm
    .generateText({
      $id: "guideGenerator",
      stopSequences: ["\n[City]"],
    })
    .wire("<-PALM_KEY.", starter.secrets({ keys: ["PALM_KEY"] }));

  input.wire(
    "item->activity",
    guideTemplate
      .wire("location<-.", location)
      .wire("prompt->text", guideGenerator.wire("completion->guide", output))
  );
});

const combineGuides = starter.runJavascript({
  name: "combine",
  $id: "combineGuides",
  code: function combine({
    location,
    activities,
    guides,
  }: {
    location: string;
    activities: string[];
    guides: Record<string, { guide: string }>[];
  }) {
    const guideList = guides.map((item) => item.guide);
    return `# ${location}\n${activities
      .map((activity, index) => `## ${activity}\n${guideList[index]}\n\n`)
      .join("")}`;
  }.toString(),
});

location.wire(
  "*",
  travelItineraryTemplate.wire(
    "prompt->text",
    travelItineraryGenerator.wire(
      "completion->itinerary",
      splitItinerary.wire(
        "result->list",
        createGuides.wire(
          "list->guides",
          combineGuides
            .wire("result->guide", output)
            .wire("<-location", location)
            .wire("activities<-result", splitItinerary)
        )
      )
    )
  )
);

export default board;
