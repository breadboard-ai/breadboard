import { agents } from "@google-labs/agent-kit";
import { board } from "@google-labs/breadboard";

const contextFromText = (text: string, role?: string) => {
  const parts = [{ text }];
  return role ? { role, parts } : { parts };
};

const sampleContext = [
  contextFromText(
    `book description: This book will be about breadboards and how awesome they are:

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

const writerPersona = contextFromText(
  `You are a famous author. You are writing a novel.
Your well-established process starts with collecting the book description, chapter target, page target, fiction genre, setting, story arc, tonality and the working title.

Then you write each chapter of the novel, starting from the first chapter.

You know that as a general rule of thumb, shorter chapters tend to be more snappy and fast-paced, whereas longer chapters offer more opportunities for plot and character development, world-building, and other integral story elements. That's why the average chapter length tends to be between 1,500-8,000 words.

Each chapter builds on the next one, culminating in a masterpiece that will fly off the bookshelves.`
);

const writerTask = contextFromText(`Write a chapter of this book`);

export default await board(({ context }) => {
  context
    .title("Book Specs")
    .isObject()
    .behavior("llm-content")
    .examples(JSON.stringify(sampleContext, null, 2));

  const loop = agents.looper({
    $metadata: { title: "Looper" },
    context,
    plan: { max: 3 },
  });

  const writer = agents.superWorker({
    $metadata: { title: "Writer" },
    in: loop.loop,
    persona: writerPersona,
    task: writerTask,
  });

  writer.out.as("context").to(loop);

  return { context: loop.done };
}).serialize({
  title: "Looper Testing Grounds",
  description: "A board where we teach the Looper Node to crawl/walk/fly.",
  version: "0.0.1",
});
