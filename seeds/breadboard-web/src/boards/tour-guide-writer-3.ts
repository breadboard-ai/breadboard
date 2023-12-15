/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, V, base, recipe, recipeAsCode } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";

const metadata = {
  title: "Tour Guide Writer",
  description:
    "This boards attempts to write a tour guide for a specified location. This time, it takes a text generator board as an input.\n\nInterestingly, because we currently don't have a way to close over the inputs of the invoked text generator, this board exposes the text generator's inputs as its own inputs.",
  version: "0.0.3",
};

const inputSchema = {
  type: "object",
  properties: {
    location: {
      type: "string",
      title: "Location",
      description: "The location for which to write a tour guide",
      examples: ["Stresa, Italy"],
    },
    generator: {
      type: "board",
      title: "Text Generator",
      description: "The text generator to use for writing the tour guide",
      examples: ["/graphs/text-generator.json"],
    },
  },
  required: ["location"],
} satisfies Schema;

const outputSchema = {
  type: "object",
  properties: {
    guide: {
      type: "string",
      title: "Guide",
      description: "The tour guide for the specified location",
    },
  },
} satisfies Schema;

const graph = recipe(async () => {
  const input = base.input({ $id: "parameters", schema: inputSchema });

  const output = base.output({ $id: "guide", schema: outputSchema });

  const travelItineraryTemplate = starter.promptTemplate({
    template: `[Place] Seattle, WA
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
    $id: "travelItinerary",
  });

  input.location.as("guide").to(output);

  const travelItineraryGenerator = core.invoke({
    $id: "travelItineraryGenerator",
    stopSequences: ["\n[Place]"],
    path: input.generator as V<string>,
    useStreaming: false,
  });

  type Itinerary = { itinerary: string };
  type SplitItinerary = { list: string[] };

  const splitItinerary = recipeAsCode<Itinerary, SplitItinerary>(
    ({ itinerary }) => {
      const list = itinerary
        .split(/[0-9]{1,2}\)/)
        .map((e) => e.trim())
        .filter((e) => e !== "");
      return { list };
    }
  );

  const createGuides = core.map({});

  return output;
});

export default await graph.serialize(metadata);
