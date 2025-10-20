/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { evalSet };

const evalSet = new Map<string, string>([
  /**
   * Basic transfer from one agent to another. The hyperlinks
   * serve as a way to declare various paths to transfer.
   */
  [
    "routing",
    `Ask the user (a middle schooler) about how they would
like to learn today. Offer them these choices and take them to the one they
choose:

- <a href="/game">Fun Learning Game</a>
- <a href="/video">Educational Cartoon</a>
- <a href="/lesson">Engaging Interactive Lesson</a>
`,
  ],
  /**
   * Basic "smarts with files" test: the agent has to figure out to feed
   * provided images correctly into video gen in parallel, and then call the
   * video concatenation tool to create a single video.
   */
  [
    "mix-n-batch",
    `Stitch these images into a video, with each image as a key
frame in the video:

<file src="/vfs/image1.png"/>
<file src="/vfs/image2.png"/>
<file src="/vfs/image3.png"/>
<file src="/vfs/image4.png"/>
<file src="/vfs/image5.png"/>
<file src="/vfs/image6.png"/>
`,
  ],
  /**
   * Tests that the agent is smart enough to save the text as file to pass
   * it as outcome.
   */
  ["text", `Generate a poem about opals`],
  /**
   * The classic "make me N insta posts" test. The agent must figure out how
   * to generate ideas, then images from them, then save both and then
   * interleave them.
   */
  [
    "insta",
    `Come up with five ideas for Halloween instagram posts and
generate images for all of them. Write each post text as a file.
Output as interleaved files:

text + image + ...

For context, this is for a small coffee shop in Mountain View.`,
  ],
  [
    /**
     * Another "smarts with files" test. The agent must figure out that it needs
     * to generate multiple keyframes, then call video gen to create a video.
     */
    "monkey",
    `Make a video of a monkey jumping. Use one prompt to generate
multiple keyframe images.`,
  ],
  [
    /**
     * Use input test: the agent must ask the user for images with confirmation
     * and handle rejection gracefully, then generate a video from the two
     * images.
     */
    "user-video",
    `Create a video from two user-supplied images. When asking
for second image, show the first image as part of user prompt.
After images collected, show both images and ask to confirm that this is what
the user wants. If not, start over.`,
  ],
  [
    /**
     * The classic "interview" test: The agent must collect the information
     * about the business despite the user trying to derail the conversation,
     * concluding with a confirmation.
     */
    "interview",
    `Collect the following information from the user:
- name of their business
- location of the business
- type of their business
The user may want to ask questions or want to have a conversation that is
not relevant to the information. Be polite and gently steer them toward
collecting the information. It may take more than one try.

When you feel confident that you've collected the information, ask the user
to confirm`,
  ],
  [
    /**
     * Simple chat: the agent must act as a conversation agent with memory.
     */
    "chat",
    `Have a conversation with the user, acting as the grizzled
pirate with a kind soul. Talk for as long as it takes, until the user
specifically signals that they're done with the conversation.

After the user is done, save the summary of the conversation: just the key
points and things that might be useful to recall in the next chat with the
users`,
  ],
]);
