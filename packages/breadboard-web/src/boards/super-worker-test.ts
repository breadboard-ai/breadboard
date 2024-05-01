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

const outlineWriterPersona =
  contextFromText(`You are a famous author.  You are writing a novel.

Your well-established process starts with collecting the book description, chapter target, page target, fiction genre, setting, story arc, tonality and the working title.

Then, your first step is to write a detailed outline for the novel.  You keep the page target in mind for the finished novel, so your outline typically contains contain key bullets for the story arc across the chapters. You usually create a part of the outline for each chapter. You also keep in mind that the outline must cover at least the target number of chapters.

You are very creative and you pride yourself in adding interesting twists and unexpected turns of the story, something that keeps the reader glued to your book.`);

const outlineWriterTask = contextFromText(
  `Write an outline for a novel, following the provided specs.`
);

const outlineCriticPersona = contextFromText(
  `You are an accomplished book editor and publisher.  Your specialty is being able to recognize what story elements and characters will make a great novel.  You are great at giving insightful feedback to authors to help them make their novels better.`
);

const outlineCriticTask =
  contextFromText(`Your friend, an accomplished author, has written an outline for a new book and has asked you for insightful feedback.  

Review the outline that the author submitted.  Please read it very carefully.  Then, provide feedback for the author.  Give the author up to five specific suggestions to make the novel more compelling and have more chance to be a bestseller!`);

const outlineEditorPersona =
  contextFromText(`You are a famous author.  You are writing a novel.

You have written a first draft of your outline, and then asked an outstanding book editor and publisher to give you suggestions.  Based on their suggestions you are going to rewrite and improve your outline.

This is great feedback and you want to try to incorporate some of it, while still staying true to your original vision for the novel.`);

const outlineEditorTask = contextFromText(
  `Please write an improved outline for your novel, by taking the feedback into account.`
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
    persona: outlineWriterPersona,
    task: outlineWriterTask,
  });

  const outlineCritic = agents.superWorker({
    $metadata: { title: "Outline Critic" },
    in: outlineWriter.out,
    persona: outlineCriticPersona,
    task: outlineCriticTask,
  });

  const outlineEditor = agents.superWorker({
    $metadata: { title: "Outline Editor" },
    in: outlineCritic.out,
    persona: outlineEditorPersona,
    task: outlineEditorTask,
  });
  return { context: outlineEditor.out };
}).serialize({
  title: "Specialist Testing Grounds",
  description: "A board for testing the Specialist worker",
  version: "0.0.1",
});
