# The Screens Experiment

The idea: what if LLM wrote a relatively small, sandboxed piece of code while
still being able to control UI and access capabilities, loosely following the
[object-capability model](https://en.wikipedia.org/wiki/Object-capability_model).

The concept: ask LLM to implement a function that is the invoked inside of a
sandbox.

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

The MCP client offers access to the "Screen Server", which is the most
interesting one. It manages a set of predefined screens and allows the app
generated code to update them and receive user events.

It has two methods:

- `getUserEvents` -- gets the list of user events. Will block until it receives
  at least one user event. Accumulates and drains the queue of user events when
  called.

- `updateScreens` - updates screens with specified ids. This call does not block
  on user input.

Combined together, `getUserEvents` and `renderScreen` form the rendering loop
for the application UI.

## Experimenting

To generate screens. Edit the `src/screenify.ts` and change the `intent` and
`APP_NAME` to values that reflect what you're like.

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
