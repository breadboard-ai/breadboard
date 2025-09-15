# The Screens Experiment

The idea: what if LLM wrote a relatively small, sandboxed piece of code while
still being able to control UI and access capabilities, loosely following the
[object-capability model](https://en.wikipedia.org/wiki/Object-capability_model).

The concept: ask LLM to implement a function that is the invoked inside of a
sandbox.

```js
export default async function (capabilities) {
  const { screens, generate, console } = capabilities;

  // generated code here
}
```

In this experiment, there are three capabilities:

- `generate` -- provides access to LLM generation
- `mcp` -- the MCP client
- `console` -- the typical console stuff
- `screens` -- the screen server, which provides ability to show UI.

In this experiment, the screen server is the most interesting one. It manages a
set of predefined screens and allows the app generated code to update them and
receive user events.

It has two methods:

- `getUserEvents` -- gets the list of user events. Will block until it receives
  at least one user event. Accumulates and drains the queue of user events when
  called.

- `updateScreens` - updates screens with specified ids. This call does not block
  on user input.

Combined together, `getUserEvents` and `renderScreen` form the rendering loop
for the application UI.

To generate code:

```sh
npm run generate adventure-game
```

To run code (does not yet work):

```sh
npm run dev
```
