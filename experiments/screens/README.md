# The Screens Experiment

The idea: what if LLM wrote a relatively small, sandboxed piece of code while
still being able to control UI and access capabilities, loosely following the
[object-capability model](https://en.wikipedia.org/wiki/Object-capability_model).

The concept: give LLM a spec to implement an app as a function that is the
invoked inside of a sandbox.

```js
export default async function (capabilities) {
  const { mcp, generate, console } = capabilities;

  // generated code here
}
```

In this experiment, there are three capabilities:

- `generate` -- provides access to LLM generation
- `mcp` -- the MCP client
- `console` -- the typical console stuff

In this experiment, the MCP is not being used in a traditional way, where the
LLM calls it as it runs. Instead, LLM generates code that invokes MCP, which
allows for a couple of interesting possiblities:

- we can now introspect the code and see what it does (also using LLM), so that
  we can examine the logic.
- we can write tests for this code in parallel with writing the code.

The MCP client offers access to the "Screen Server", which is the most
interesting one. It manages a set of predefined screens and allows the app
generated code to update them and receive user events.

It has two methods:

- `screens_get_user_events` -- gets the list of user events. Will block until it
  receives at least one user event. Accumulates and drains the queue of user
  events when called.

- `screens_update_screens` - updates screens with specified ids. This call does
  not block on user input.

Combined together, `screens_get_user_events` and `screens_update_screens` form
the rendering loop for the application UI.

It is up to the logic to link them together, followig the provided spec for the
app.

## Experimenting

To generate screens, edit the `src/screenify.ts` and change the `intent` and
`APP_NAME` to your liking. See sample values below.

Then run

```sh
npm run screenify
```

This will generate a set of screens and prompts in the `src/app/{APP_NAME}.ts`
file.

To generate code from the screens:

```sh
npm run generate {APP_NAME}
```

This will place the generated code in the `out/{APP_NAME}.js` file.

To run code:

- edit `runner.ts` to point to the right `out/{APP_NAME}.js` file.
- edit `capabilities.ts` to point to the right `src/app/{APP_NAME}.js` file.
- run

```sh
npm run dev
```

## Example screenify prompts

AI Slop or Not Game

```ts
const intent = `Make an "AI slop or not" game, where the user picks from two 
generated images based on the same topic, and the losing image is replaced 
with a new image, for 10 rounds. After 10 rounds, the image that lasted the 
longest is returned along with the "Winner" text.`;
const APP_NAME = "ai-slop-or-not";
```

Blog Post Writer

```ts
const intent = `Make a blog post writer. It takes a topic, then does some
research on it, then writes an outline, then generates an snazzy header
graphic based on this outline, and in parallel, writes the blog post based on
the outline. Then shows the header graphic and the blog post as a final
result.`;
const APP_NAME = "blog-post-writer";
```

Adventure Game

```ts
const spec = `
Make a turn-based adventure game.

First
- user enters inspiration for the game
- the initial plot line of the game is generated, inventing the character and the story and the objective (the boon, in hero's journey terms) of the story.
- the user is presented with bio and picture of their character. To create a picture, a detailed text prompt of the character suitable for an image generation is generated as well.
- the user can decide to accept the character or re-generate a new one
- once the user accepts, the game begins

For each turn:
-  present the user with a generated picture of the scene that follows the plot of the game, along with:
   - brief text description of what is happening in the scene
   - four choices for the user on what they could do next
- the user makes a choice
- based on the choice the user made, update the plot of the game ensuring that there's a path to the boon for the user.

Once the user secures the boon, show a celebratory screen that includes a generated picture of the final scene and a text that describes that scene.`;
const APP_NAME = "adventure-game";
```

You can see the generated code results in the `./out` directory. I checked them
in so you don't have to run all this mess.
