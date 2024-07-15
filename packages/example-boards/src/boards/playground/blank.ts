import { board } from "@google-labs/breadboard";

export default await board(({ text }) => {
  return { text };
}).serialize({
  title: "Blank board",
  description: "A blank board. Use it to start a new board",
  version: "0.0.1",
});
