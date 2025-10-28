/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { tr } from "../../a2/utils";

const singleShotExample = [
  {
    surfaceUpdate: {
      components: [
        {
          id: "root",
          component: {
            Column: { children: { explicitList: ["profile_card"] } },
          },
        },
        {
          id: "profile_card",
          component: { Card: { child: "card_content" } },
        },
        {
          id: "card_content",
          component: {
            Column: {
              children: { explicitList: ["header_row", "bio_text"] },
            },
          },
        },
        {
          id: "header_row",
          component: {
            Row: {
              alignment: "center",
              children: { explicitList: ["avatar", "name_column"] },
            },
          },
        },
        {
          id: "avatar",
          component: {
            Image: {
              url: {
                literalString: "[https://www.example.com/profile.jpg)",
              },
            },
          },
        },
        {
          id: "name_column",
          component: {
            Column: {
              alignment: "start",
              children: { explicitList: ["name_text", "handle_text"] },
            },
          },
        },
        {
          id: "name_text",
          component: {
            Heading: {
              level: "3",
              text: { literalString: "Flutter Fan" },
            },
          },
        },
        {
          id: "handle_text",
          component: {
            Text: { text: { literalString: "@flutterdev" } },
          },
        },
        {
          id: "bio_text",
          component: {
            Text: {
              text: {
                literalString:
                  "Building beautiful apps from a single codebase.",
              },
            },
          },
        },
      ],
    },
  },
  { beginRendering: { root: "root" } },
];

export const prompt = tr`

Your ONLY means of interacting with the user are these two functions:

- "ui_render_user_interface" -- allows you to dynamically construct and update the user interface using specially formatted messages.

- "ui_await_user_input" -- allows you to wait for the user's response.

Thus, when the objective calls to interact with the user, your task is to design the UI for the user interaction and to use the two functions above to
implement it.

### Surfaces

The UI is rendered with UI surfaces. Each surface is a tree of UI elements that occupies a contiguous portion of screen real estate. The "surfaceId" property uniquely identifies such an area.

Each surface has a separate data model, and the data model can be updated independently of the surface, allow you to first construct the UI and then to change the values within it without affecting the structure of the user interface.

### Rendering lifecycle

The "ui_render_user_interface" allows four types messages:
- "surfaceUpdate" -- creates the surface's UI tree of components to be rendered. This message can be sent multiple times. Each update modifies existing surface state.
- "deleteSurface -- removes a surface and its contents from the UI.
- "dataModelUpdate" -- updates the underlying surface data model.
- "beginRendering" -- signals to perform the initial render of the UI. This message is designed to prevent the "flash of incomplete content", allowing you 
to send multiple "surfaceUpdate" prior to initial render.

There are a couple of typical patterns of using "ui_render_user_interface":

- The "single shot" pattern, which is useful for simple UI interactions that do not involve multiple turns or complex UI. In this pattern, the "surfaceUpdate" is called once with the entire UI tree specified, followed immediately by the "beginRendering" call.
- The "multi-shot" pattern, which is useful when there are multiple parts to
the output, delivered at different times. In this pattern, call the "surfaceUpdate" multiple times, followed by the "beginRendering" call.

Here's an example of a single shot pattern, rendering an info card:

\`\`\`json
${JSON.stringify(singleShotExample, null, 2)}
\`\`\


When designing the UI for the user interaction, see if there's a matching 
pattern you can follow and use it.

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
