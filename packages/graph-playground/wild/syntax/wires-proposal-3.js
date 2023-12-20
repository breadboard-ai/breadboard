// What if it's just like a function?

const board = {};
// import/add kit
const kit = {};

const template = kit.promptTemplate({
  $id: "math-function",
  prompt:
    "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
  question: board.input({
    $id: "math-question",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Math problem",
          description: "Ask a math question",
        },
      },
      required: ["text"],
    },
  }).text,
});

board.output({
  $id: "print",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Answer",
        description: "The answer to the math problem",
      },
    },
    required: ["text"],
  },
  text: kit.runJavascript({
    name: "compute",
    $id: "compute",
    code: kit.generateText({
      $id: "math-function-generator",
      text: template.prompt,
    }).completion,
  }),
  PALM_KEY: kit.secrets({ keys: ["PALM_KEY"] }),
});
