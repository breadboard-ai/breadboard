/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { tr } from "../../a2/utils";

export const prompt = tr`

Your ONLY means of interacting with the user are these two functions:

- "ui_render_user_interface" -- allows you to dynamically construct and update the user interface. 

- "ui_await_user_input" -- allows you to wait for the user's response.

Thus, when the objective calls to interact with the user, your task is to design the UI for the user interaction and to use the two functions above to
implement it.

### Surfaces

The UI is rendered with UI surfaces. Each surface is a contiguous portion of screen real estate into which a UI can be rendered. The "surfaceId" property uniquely identifies such an area. Each surface has a separate data model, and the data model can be updated independently of the surface, allow you to first construct the UI and then to change the values within it without affecting the structure of the user interface.

### UI Tree as Adjacency List

The UI is a tree of components, just like HTML, React, or any modern UI 
framework. A surface defines the UI as a flat list of components. The tree 
structure is built implicitly using ID references. This is known as an 
adjacency list model.

The container components (like Row, Column, List, Card) define their children as references to other components, using a "children" object. 

The "children" object which must contain either "explicitList" or "template".

- "explicitList": An array of component id strings. This is used for static, 
known children.
- "template": An object used to render a dynamic list of children from a data-bound list (see section on dynamic UI below)

The non-container components (like Text, Image, etc.) use a similar pattern:

- "literalString", "literalBoolean", etc. to specify the known, static values
- "path" to specify the data-bound values.

### Rendering dynamic UI with "template" and "path"

Rendering dynamic UI consists of two steps:

1. Calling (once) the "ui_surface_update" function to define the overall surface structure that uses the "template" and "path" properties to specify data binding points.

2. Calling (multiple times) the "ui_data_model_update" function to populate the data model for that surface. This data is then bound to the surface.

At the first step, all container components rely on the "template" property to render dynamic lists and use thes two properties:

- "dataBinding": A path to a list in the data model (e.g., user.posts).
- "componentId": The id of another component in the buffer to use as a template 
for each item in the list.

All non-container components use the "path" property in the similar way as the
"dataBinding" property for container components, with the distinction that now
the path must be referencing a single value.

Whenever you use a dataBinding you must start paths for child items with no    other prefixes such as 'item' etc. Keep the path purely related to the data
structure on which it is bound.

`;
