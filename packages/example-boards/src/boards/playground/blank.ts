import {
  board,
  input,
} from "@breadboard-ai/build";


const text = input({ type: "string", default: "Hello World" })

export default board({
  title: "Blank board",
  description: "A blank board. Use it to start a new board",
  version: "0.0.1",
  inputs: { text },
  outputs: { text }
})
