/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const title = "Story chooser";

export const objective = `Based on the provided inspiration, generate three different loglines for a comic book story. Then, present them to the user and let the user choose one -- or an option to try again.

Once the user choses the story, return it as outcome.

If the user decides to try again, generate three more different ideas and
present them again.

Do not create names for the characters in the story. These will be picked later. For now, just focus on the setting and what is happening.

When presenting the choices to the user:

- Show the original inspiration as a separate Card
- Show each story as a Card with a "Select this story" Button
- Lastly, show the "Try again" Button to allow the user to try again.  

Inspiration:
A sarcastic phreak kid in the 90s discovers aliens lurking in the telephone lines`;
