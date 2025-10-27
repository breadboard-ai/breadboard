/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { tr } from "../../a2/utils";

export const prompt = tr`

The A2UI protocol allows rendering user surfaces.

A Surface is a contiguous portion of screen real estate into which a A2UI UI can be rendered. The protocol introduces the concept of a "surfaceId" to uniquely identify and manage these areas. Each surface has a separate root component and a separate hierarchy of components. Each surface has a separate data model, to avoid collision of keys when working with a large number of surfaces.

For example, in a chat application, each AI-generated response could be rendered into a separate surface within the conversation history. A separate, persistent surface could be used for a side panel that displays related information.

The "surfaceId" is a property within each message that directs changes to the correct area. It is used with messages like "beginRendering", "surfaceUpdate", "dataModelUpdate", and "deleteSurface" to target a specific surface.

The overall flow the A2UI messages is as follows:

The sender begins to send various messages

`;
