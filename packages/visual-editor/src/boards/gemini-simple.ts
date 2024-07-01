import { board } from "@google-labs/breadboard";
import { gemini } from "@google-labs/gemini-kit";

export default await board(({ text }) => {
  const llm = gemini.text({
    $id: "llm",
    text: text
      .isString()
      .title("Prompt")
      .examples("Write a rhyming poem about breadboards."),
  });

  return { text: llm.text };
}).serialize({
  title: "Gemini Simple",
  description: "The simplest possible example of using Gemini Kit.",
  version: "0.0.1",
});
