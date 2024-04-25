import { board } from "@google-labs/breadboard";

export default await board(({ text }) => {
  return { text };
}).serialize({
  title: "Run Python Notebook",
  description: "Runs a graph converted from a colab notebook.",
  version: "0.0.1",
});
