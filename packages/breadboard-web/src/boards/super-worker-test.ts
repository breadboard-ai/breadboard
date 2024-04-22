import { agents } from "@google-labs/agent-kit";
import { board } from "@google-labs/breadboard";

const contextFromText = (text: string, role?: string) => {
  const parts = [{ text }];
  return role ? { role, parts } : { parts };
};

const sampleContext = [
  contextFromText(
    `book description: This book will be about breadboards and how awesome they are
chapter target: 10
page target: 400
fiction genre: space opera
setting: the planet where there are no breadboards
story arc: A girl named Aurora invents a breadboard on the planet where breadboards are strictly forbidden. Through struggles and determination, and with the help of trusted friends, Aurora overcomes many challenges and changes the whole planet for the better. 
tonality: futuristic struggle, but optimistic
working title: Aurora
`,
    "user"
  ),
];

const samplePersona =
  contextFromText(`You are a famous author.  You are writing a novel.

Your well-established process starts with collecting the book description, chapter target, page target, fiction genre, setting, story arc, tonality and the working title.

Then, your first step is to write a detailed outline for the novel.  You keep the page target in mind for the finished novel, so your outline typically contains contain key bullets for the story arc across the chapters. You usually create a part of the outline for each chapter. You also keep in mind that the outline must cover at least the target number of chapters.

You are very creative and you pride yourself in adding interesting twists and unexpected turns of the story, something that keeps the reader glued to your book.`);

const sampleTask = contextFromText(
  `Write an outline for a novel, following the provided specs.`
);

export default await board(({ context }) => {
  context
    .title("Book Specs")
    .isObject()
    .behavior("llm-content")
    .examples(JSON.stringify(sampleContext, null, 2));

  const outlineWriter = agents.superWorker({
    $metadata: { title: "Outline Writer" },
    in: context,
    persona: samplePersona,
    task: sampleTask,
  });
  return { context: outlineWriter.out };
}).serialize({
  title: "Super Worker Testing Grounds",
  description: "A board for testing the super worker",
  version: "0.0.1",
});
