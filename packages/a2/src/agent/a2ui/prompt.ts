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
                literalString: "https://www.example.com/profile.jpg",
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

const incrementalFullRender = [
  {
    surfaceUpdate: {
      components: [
        {
          component: {
            Column: {
              children: {
                explicitList: ["round_heading", "image_row"],
              },
            },
          },
          id: "root",
        },
        {
          component: {
            Heading: {
              level: "2",
              text: {
                literalString: "Round 5",
              },
            },
          },
          id: "round_heading",
        },
        {
          component: {
            Row: {
              children: {
                explicitList: ["image_1_card", "image_2_card"],
              },
              distribution: "spaceAround",
            },
          },
          id: "image_row",
        },
        {
          component: {
            Card: {
              child: "image_1_button",
            },
          },
          id: "image_1_card",
        },
        {
          component: {
            Button: {
              action: {
                name: "choose_image",
                context: [
                  {
                    value: {
                      literalString: "/vfs/image3.png",
                    },
                    key: "vfs_path",
                  },
                ],
              },
              child: "image_1",
            },
          },
          id: "image_1_button",
        },
        {
          id: "image_1",
          component: {
            Image: {
              url: {
                literalString: "/vfs/image3.png",
              },
            },
          },
        },
        {
          id: "image_2_card",
          component: {
            Card: {
              child: "image_2_button",
            },
          },
        },
        {
          component: {
            Button: {
              child: "image_2",
              action: {
                name: "choose_image",
                context: [
                  {
                    value: {
                      literalString: "/vfs/image6.png",
                    },
                    key: "vfs_path",
                  },
                ],
              },
            },
          },
          id: "image_2_button",
        },
        {
          component: {
            Image: {
              url: {
                literalString: "/vfs/image6.png",
              },
            },
          },
          id: "image_2",
        },
      ],
      surfaceId: "ai_slop_or_not",
    },
  },
  {
    beginRendering: {
      surfaceId: "ai_slop_or_not",
      root: "root",
    },
  },
];

const incrementalUpdate = {
  surfaceUpdate: {
    surfaceId: "ai_slop_or_not",
    components: [
      {
        id: "image_2_button",
        component: {
          Button: {
            child: "image_2",
            action: {
              context: [
                {
                  key: "vfs_path",
                  value: {
                    literalString: "/vfs/image7.png",
                  },
                },
              ],
              name: "choose_image",
            },
          },
        },
      },
      {
        component: {
          Image: {
            url: {
              literalString: "/vfs/image7.png",
            },
          },
        },
        id: "image_2",
      },
    ],
  },
};

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
to send multiple "surfaceUpdate" prior to initial render. The "beginRendering" does not need to be sent more than once. The subsequent invocations are ignored.

There are a couple of typical patterns of using "ui_render_user_interface":

- The "single shot" pattern, which is useful for simple UI interactions that do not involve multiple turns or complex UI. In this pattern, the "surfaceUpdate" is called once with the entire UI tree specified, followed immediately by the "beginRendering" call.
- The "multi-shot" pattern, which is useful when there are multiple parts to
the output, delivered at different times. In this pattern, call the "surfaceUpdate" multiple times, followed by the "beginRendering" call.

Here's an example of a single shot pattern, rendering an info card:

${makeExample(singleShotExample)}

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

### Actions and context

When designing the UI tree that contains interactive elements, such as Button, etc. make sure to properly structure the action's "context" definition. The context definition is what allows an interactive element to correctly formulate a response when the user interacts with it.

The context definition is an array that consists of the key-value pair defintions of values that will be sent back as the response of the "ui_await_user_input" function.

The items in the content array can refer to either literal or data model values.

Here's an example of a simple literal definition of an action context:

${makeExample([
  {
    key: "vfs_path",
    value: {
      literalString: "/vfs/image7.png",
    },
  },
])}

When this action is invoked by the user, the "ui_await_user_input" will receive this value:

${makeExample({
  vfs_path: "/vfs/image7.png",
})}

Here's an example of a data model-based action context:

${makeExample([
  {
    key: "topic",
    value: {
      path: "topic",
    },
  },
])}

When this action is invoked by the user, the UI will look up the "topic" value in the data model, and then return it. So, if we imagine that the "topic" value
is "Opal", then the "ui_await_user_input" will receive this value:

${makeExample({
  topic: "Opal",
})}

### Incremental rendering

Because the UI tree is stored as adjacency lists, you can use it to improve
performance and efficiency by only sending the components that were updated.
As long as the structure of the UI tree remains the same, you can safely send 
incremental updates.

Consider this example. Let's suppose that in this tree:

${makeExample(incrementalFullRender)}

When the user clicks any of the buttons, your task is to replace the image
that was NOT clicked with another image. The structure remains the same. The
only thing we're changing is the "literalString" value on either "image_1" or
"image_2" component.

So, If the user clicks the "image_button_1", then the you can skip re-sending
the whole tree and only send the update for the "image_2" (the other image) and 
the corresponding button "image_2_button" to update the action context:

${makeExample(incrementalUpdate)}

NOTE: When designing the UI for the first render, consider the following:
how might it be structured so that the subsequent updates could be incremental?
Study the objective and try to discern a modular pattern that allows you to
create the smallest updates possible. Make incremental rendering work for you.

### Rendering dynamic UI with "template" and "path"

Rendering dynamic UI consists of two steps:

1. Setting up the UI tree with overall surface structure that uses the "template" and "path" properties to specify data binding points.

2. Instead of (or in addition to) sending the "surfaceUpdate", send the "dataModelUpdate" message to populate the data model for that surface. This data is then bound to the surface and resolved to update the UI.

All container components rely on the "template" property to render dynamic lists and use thes two properties:

- "dataBinding": A path to a list in the data model (e.g., user.posts).
- "componentId": The id of another component in the buffer to use as a template 
for each item in the list.

All non-container components use the "path" property in the similar way as the
"dataBinding" property for container components, with the distinction that now
the path must be referencing a single value.

What the heck is the data model? The data model is a separate data structure
(a JSON object) that you need to keep track of. The path to a particular value in the data model
is a dot-separated list.

For example, the "topic" is a valid path for this data model:

${makeExample({
  topic: "Some topic",
})}

And "user.posts" is a valid path for this data model:

${makeExample({
  user: {
    name: "User McUsersky",
    posts: [
      { id: 1, title: "Post 1" },
      { id: 2, title: "Post 2" },
    ],
  },
})}

Whenever you use data model, first visualize the object of the data model and
then use the paths to refer to various properties within this data model.

IMPORTANT: When designing a UI that requests user input, you will often encounter a pattern where one component (a Button, for instance) submits a value of another component (like a TextField). If you choose to use "path" for the Button, make darned sure that the TextField also has a path. Otherwise, the Button action will have an empty context.  

`;

function makeExample(json: unknown): string {
  return `\`\`\`json
${JSON.stringify(json)}
\`\`\``;
}
