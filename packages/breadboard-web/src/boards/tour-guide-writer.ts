/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, V, base, recipe, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";

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
      examples: ["text-generator.json"],
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

const graph = recipe(() => {
  const parameters = base.input({ $id: "parameters", schema: inputSchema });

  const output = base.output({ $id: "guide", schema: outputSchema });

  const travelItinerary = templates.promptTemplate({
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
    location: parameters.location,
  });

  const travelItineraryGenerator = core.invoke({
    $id: "travelItineraryGenerator",
    stopSequences: ["\n[Place]"],
    path: parameters.generator as V<string>,
    useStreaming: false,
  });

  travelItineraryGenerator.text.as("itinerary").to(output);

  type Itinerary = { itinerary: string };
  type SplitItinerary = { list: string[] };

  const splitItinerary = code<Itinerary, SplitItinerary>(({ itinerary }) => {
    const list = itinerary
      .split(/[0-9]{1,2}\)/)
      .map((e) => e.trim())
      .filter((e) => e !== "");
    return { list };
  })({ itinerary: travelItineraryGenerator.text as V<string> });

  travelItinerary.prompt.as("text").to(travelItineraryGenerator);

  const createGuide = recipe(({ location, generator }) => {
    const guideTemplate = templates.promptTemplate({
      template: `[City] Paris, France
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
      $id: "guideTemplate",
      location: location,
      activity: base.input({}).item.as("activity"),
    });

    const guideGenerator = core.invoke({
      $id: "guideGenerator",
      stopSequences: ["\n[City]"],
      path: generator as V<string>,
      useStreaming: false,
    });

    guideTemplate.prompt.as("text").to(guideGenerator);
    return guideGenerator.text.as("guide").to(base.output({}));
  }).in({ location: parameters.location, generator: parameters.generator });

  const createGuides = core.map({
    $id: "createGuides",
    board: createGuide,
    list: splitItinerary.list,
  });

  type GuideMaterials = {
    location: string;
    activities: string[];
    guides: Record<string, { guide: string }>[];
  };

  type Guide = { guide: string };

  const combineGuides = code<GuideMaterials, Guide>(
    ({ location, activities, guides }) => {
      const guideList = guides.map((item) => item.guide);
      return {
        guide: `# ${location}\n${activities
          .map((activity, index) => `## ${activity}\n${guideList[index]}\n\n`)
          .join("")}`,
      };
    }
  )({
    location: parameters.location as V<string>,
    activities: splitItinerary.list,
    guides: createGuides.list as V<GuideMaterials["guides"]>,
  });

  combineGuides.guide.to(output);

  return output;
});

export default await graph.serialize(metadata);
