/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";

export const title = "Costume Maker";

const parts: DataPart[] = [
  // Layout description.
  {
    text: `Put the Video at the top. Then underneath it there is a Row which MUST have a
List on the left. In the List is a Heading that says "Your Costumes" and,
beneath it, a unified, short, combined summary of all the outfits (a couple of
paragraphs of plain text only). On the right hand side of the Row is a Card with
a 2x2 grid containing the four Images.`,
  },

  // Descriptions.
  {
    text: `The Industrial Maintenance Crew: The family dresses as various workers responsible for the building's systems.

Dad: HVAC Technician - wear a green polo shirt (like in the photo) or a work shirt, coveralls, a tool belt with wrenches, and a hard hat.
Mom: Electrical Engineer - wear a safety vest over practical clothing, carry a clipboard with "blueprints," and perhaps a multimeter prop.
Kids: Junior Apprentices - smaller safety vests, toy hard hats, and plastic tool kits (wrenches, screwdrivers) attached to their belts.
The Building's Core Components: Each family member embodies a different element of the exposed ceiling infrastructure.

Dad: The HVAC Duct - a silver jumpsuit or silver fabric wrapped around clothes, perhaps with circular cutouts or a corrugated texture.
Mom: The Cable Tray - a grey or metallic top and pants, with strips of black, white, and colored "wires" (yarn or fabric strips) attached in a grid pattern.
Kids: The Fluorescent Lights - rectangular white cardboard boxes worn over their torsos, perhaps with translucent white paper or glow sticks inside for illumination.
The Glitch in the Machine: A futuristic, slightly digital, and uniform theme inspired by the structured, tech-like background.

Dad: The CPU - a simple grey or black outfit with a large "chip" design (cardboard or felt) on the chest, possibly with pixelated glasses.
Mom: The Motherboard - a green or blue outfit with circuit board lines (drawn with fabric markers or black tape) and small "component" details (bottle caps, plastic shapes) glued on.
Kids: Data Packets / Pixels - wear solid color outfits (e.g., black, white, grey) with contrasting squares or rectangles attached, creating a fragmented, digital look.
The Hidden Creatures of the Vents: Imagine tiny, whimsical creatures that live unnoticed within the building's ducts and pipes.

Dad: The Grimy Filter Monster - a shaggy grey or brown full-body costume made from faux fur or shredded fabric, with large googly eyes and some "dust" (cotton batting) attached.
Mom: The Sparky Cable Spider - a black or dark grey outfit with multiple "legs" (padded fabric tubes or pool noodles) extending from the sides and back, adorned with colorful "wires" (yarn or pipe cleaners) that appear to connect.
Kids: Dust Bunnies - round, fluffy white or grey costumes made from fleece or faux fur, with small antennae or playful eyes peeking out.`,
  },

  // Images.
  { text: `Costume Visualizations: ` },
  {
    storedData: { handle: "imagehandle1", mimeType: "image/jpeg" },
  },
  {
    storedData: { handle: "imagehandle2", mimeType: "image/jpeg" },
  },
  {
    storedData: { handle: "imagehandle3", mimeType: "image/jpeg" },
  },
  {
    storedData: { handle: "imagehandle4", mimeType: "image/jpeg" },
  },

  // Video.
  { text: `Summary Video: ` },
  {
    storedData: { handle: "videohandle", mimeType: "video/mp4" },
  },
];

export const objective: LLMContent = { role: "user", parts };
