/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board({
  title: "Tour Guide Writer",
  description: "Based on the location specified, writes a tour guide for it",
  version: "0.0.1",
});
const starter = board.addKit(Starter);

const input = board.input({
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
        title: "Location",
        description: "The location for which to write a tour guide",
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

const travelItineraryGenerator = starter
  .generateText({
    $id: "travelItineraryGenerator",
    stopSequences: ["\n[Place]"],
  })
  .wire("<-PALM_KEY", starter.secrets(["PALM_KEY"]));

function splitString({ itinerary }: { itinerary: string }) {
  return itinerary
    .split(/[0-9]{1,2}\)/)
    .map((e) => e.trim())
    .filter((e) => e !== "");
}

const splitItinerary = starter.runJavascript("splitString", {
  $id: "splitItinerary",
  code: splitString.toString(),
});

input.wire(
  "*",
  travelItineraryTemplate.wire(
    "prompt->text",
    travelItineraryGenerator.wire(
      "completion->itinerary",
      splitItinerary.wire("result->guide", output)
    )
  )
);

export default board;
