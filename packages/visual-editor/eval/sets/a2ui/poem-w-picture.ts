/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Simple poem w/picture";

export const objective = llm`

Place the poem in the left column, and a picture in the right, with the caption
under the picture. Put the picture and the caption into a separate card.

Picture:
A Shattered Rainbow in a stone, It holds the ocean, the sunset's moan. With fire-filled milk and shifting light, A dreamy flicker, cold and bright. The earth's own magic, deep and sweet, Where all the colors gently meet.

Caption:
The picture of a shattered Rainbow opal

Picture:
`.asContent();

objective.parts.push({
  storedData: { handle: "fakehandle", mimeType: "image/png" },
});
