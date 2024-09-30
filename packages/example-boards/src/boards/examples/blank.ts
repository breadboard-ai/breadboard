import { board, input } from "@breadboard-ai/build";

const text = input();

export default board({
  title: "Basics: Blank board",
  description: "A blank board. Use it to start a new board",
  version: "0.0.1",
  inputs: { text },
  outputs: { text },
});
