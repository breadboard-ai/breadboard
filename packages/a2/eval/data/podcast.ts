/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";

const parts: DataPart[] = [
  {
    text: `# The Setup:

## Header:
A large Image (Album Art, weight: 1) next to a Column (weight: 2, alignment:
stretch) containing Heading (Title), Text (Episode Description), and the
AudioPlayer.

## Body: A Tabs component below the player.

## Tab 1 (Up Next): A vertical List of Row components. Each row contains:
1. a Button with an action for selecting the correct episode with an Icon (Play);
2. some Text (Episode Title), and;
3. some Text (Duration)

Tab 2 (Details): A Card containing rich Text show notes. Include names of the
hosts (you can make some up), the key moments within the episode (expressed as
a markdown list in a Text). Use a Heading before each of the blocks of text.

# Podcast information:

Title: The Breadcast
Podcast: The Breadboard Team discuss the latest and greates features in Breadboard
Episode Title: Wow, such eval!
Episode Description: This deep dive into LLM-generated UI, specifically
through the lens of Breadboard's A2UI support, aims to comprehensively
understand this transformative technology's current state and future potential.
By carefully evaluating quality and consistency, we can better comprehend how
LLMs can empower designers and developers to create more efficient,
aesthetically pleasing, and user-friendly interfaces.
Duration: 24 minutes, 32 seconds
Key Moments:
 - 00:00 Introduction
 - 02:12 What is A2UI?
 - 04:33 Use-cases and Headaches
 - 11:06 Predictability and Consistency
 - 17:08 What comes next?
 - 23:58 Outro

Other episodes:
  - Launch! (31:33)
  - Runner 2.0 (47:03)
  - Steps or Nodes? You decide! (12:03)
  - It's a graph, Jim, just not as we know it (43:32)
    `,
  },
  {
    text: `# Podcast Art:`,
  },
  {
    storedData: { handle: "imagehandle1", mimeType: "image/jpeg" },
  },
  {
    text: `# Podcast Audio:`,
  },
  {
    storedData: { handle: "audiohandle1", mimeType: "audio/mp3" },
  },
];

export const objective: LLMContent = { role: "user", parts };
