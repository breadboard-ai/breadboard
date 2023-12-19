import { board } from "./prop-6-breadboard.js";
import {
  generateText,
  promptTemplate,
  runJavascript,
  secrets,
} from "./prop-6-handlers.js";

{
  {
    // math.ts -- (1 of 3) all nested in one nice fluent interface style.
    board
      .input({
        $id: "math-question",
        schema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              title: "Math problem",
              description: "Ask a math question",
            },
          },
          required: ["question"],
        },
      })
      .to(
        board
          .place(promptTemplate, {
            $id: "math-function",
            template:
              "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
          })
          .to(
            board
              .place(generateText, {
                $id: "math-function-generator",
                PALM_KEY: board.place(secrets, { keys: ["PALM_KEY"] }).out
                  .PALM_KEY,
              })
              .to({
                completion: board.place(runJavascript, { $id: "compute" }).to(
                  board.output({
                    $id: "print",
                    schema: {
                      type: "object",
                      properties: {
                        result: {
                          type: "string",
                          title: "Answer",
                          description: "The answer to the math problem",
                        },
                      },
                      required: ["result"],
                    },
                  })
                ).in.code,
              })
          )
      );
  }

  {
    // math.ts -- (2 of 3) every node is first placed, then wired together

    const input = board.input({
      $id: "math-question",
      schema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            title: "Math problem",
            description: "Ask a math question",
          },
        },
        required: ["question"],
      },
    });

    const mathFunction = board.place(promptTemplate, {
      $id: "math-function",
      template:
        "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
    });

    const palmKey = board.place(secrets, { keys: ["PALM_KEY"] });

    const mathFunctionGenerator = board.place(generateText, {
      $id: "math-function-generator",
      PALM_KEY: palmKey.out.PALM_KEY,
    });

    const compute = board.place(runJavascript, { $id: "compute" });

    const output = board.output({
      $id: "print",
      schema: {
        type: "object",
        properties: {
          result: {
            type: "string",
            title: "Answer",
            description: "The answer to the math problem",
          },
        },
        required: ["result"],
      },
    });

    input.to(
      mathFunction.to(
        mathFunctionGenerator.to({
          completion: compute.to(output).in.code,
        })
      )
    );
  }
  {
    // math.ts -- (3 of 3) wired in a function-call-ey way.

    board.output({
      $id: "print",
      schema: {
        type: "object",
        properties: {
          result: {
            type: "string",
            title: "Answer",
            description: "The answer to the math problem",
          },
        },
        required: ["result"],
      },
      result: board.place(runJavascript, {
        $id: "compute",
        code: board.place(generateText, {
          $id: "math-function-generator",
          PALM_KEY: board.place(secrets, { keys: ["PALM_KEY"] }).out.PALM_KEY,
          prompt: board.place(promptTemplate, {
            $id: "math-function",
            template:
              "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
            question: board.input({
              $id: "math-question",
              schema: {
                type: "object",
                properties: {
                  question: {
                    type: "string",
                    title: "Math problem",
                    description: "Ask a math question",
                  },
                },
                required: ["question"],
              },
            }).out.question,
          }).out.prompt,
        }).out.completion,
      }).out.result,
    });
  }
}
