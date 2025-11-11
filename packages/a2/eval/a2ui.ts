/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getUIDataUpdatePrompt } from "../src/agent/a2ui/prompts/create-data-update";
import { getDesignSurfaceSpecsPrompt } from "../src/agent/a2ui/prompts/design-surface-specs";
import { getCreateUILayoutPrompt } from "../src/agent/a2ui/prompts/create-ui-layout";
import { llm } from "../src/a2/utils";
import { config } from "dotenv";
import { err, ok, toJson } from "@breadboard-ai/utils";
import { exit } from "process";
import type { ParsedSurfaces, Surface } from "../scripts/surface";
import { session } from "../scripts/eval";
import { Outcome } from "@breadboard-ai/types";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

session({ name: "A2UI", apiKey: GEMINI_API_KEY }, async (session) => {
  const generateContent = (await import("../src/a2/gemini")).generateContent;

  const objective = `Play a learning quiz on the following subject with a high school student, using a series of multiple-choice questions:
  <subject>Fall of Communism in Soviet Russia</subject>

  As the student answers the question, regulate the difficulty of questions. Start with the easy ones, and if the student is answering them correctly, proceed to the more challenging ones.
  When the student fails to answer the question correctly, give them a brief historical overview and re-ask the question again in a slightly different way to test their knowledge.

  After 5 questions, congratulate the student and exit the quiz. A student may decide to exit early and that is okay.
  Before exiting, record the answers and the summary of the session for the teacher:

  - questions asked and student's responses
  - whether or not the student completed the quiz
  - what the student learned
  - where the student should concentrate on learning`;

  session.eval("Quiz (spec)", async ({ moduleArgs }) => {
    async function generateSpec(): Promise<Outcome<ParsedSurfaces>> {
      const surfaces = await generateContent(
        "gemini-flash-latest",
        getDesignSurfaceSpecsPrompt([llm`${objective}`.asContent()]),
        moduleArgs
      );
      if (!ok(surfaces)) return surfaces;

      const parsedSurfaces: { surfaces: Surface[] } | undefined = toJson([
        surfaces.candidates.at(0)!.content!,
      ]);
      if (!parsedSurfaces) {
        console.log("ERROR", "No surfaces found");
        return err(`No surfaces found`);
      }

      return parsedSurfaces;
    }

    async function renderSurface(renderableSurface: Surface) {
      console.log(`Rendering ${renderableSurface.surfaceId}`);
      const prompt = getCreateUILayoutPrompt([
        llm`${JSON.stringify(renderableSurface)}`.asContent(),
      ]);

      const ui = await generateContent(
        "gemini-flash-latest",
        prompt,
        moduleArgs
      );
      if (!ok(ui)) return ui;

      return toJson([ui.candidates.at(0)!.content!]);
    }

    const parsedSurfaces = await generateSpec();
    if (!ok(parsedSurfaces)) return parsedSurfaces;

    return Promise.all(
      parsedSurfaces.surfaces.map((surface) =>
        renderSurface(surface).then((a2ui) => ({ a2ui }))
      )
    );
  });

  session.eval("Quiz (example data)", async ({ moduleArgs }) => {
    const quizQuestionSurface = [
      {
        surfaceUpdate: {
          surfaceId: "quiz_question_surface",
          components: [
            {
              id: "root_column",
              component: {
                Column: {
                  children: {
                    explicitList: [
                      "heading_quiz_title",
                      "text_progress",
                      "text_question",
                      "multiple_choice_answers",
                      "row_actions",
                    ],
                  },
                },
              },
            },
            {
              id: "heading_quiz_title",
              component: {
                Heading: {
                  text: {
                    path: "/quiz_title",
                  },
                  level: "1",
                },
              },
            },
            {
              id: "text_progress",
              component: {
                Text: {
                  text: {
                    path: "/progress_text",
                  },
                },
              },
            },
            {
              id: "text_question",
              component: {
                Text: {
                  text: {
                    path: "/question_text",
                  },
                },
              },
            },
            {
              id: "multiple_choice_answers",
              component: {
                MultipleChoice: {
                  selections: {
                    path: "/selection_results",
                  },
                  options: [
                    {
                      label: {
                        path: "/options/0/label",
                      },
                      value: "a",
                    },
                    {
                      label: {
                        path: "/options/1/label",
                      },
                      value: "b",
                    },
                    {
                      label: {
                        path: "/options/2/label",
                      },
                      value: "c",
                    },
                    {
                      label: {
                        path: "/options/3/label",
                      },
                      value: "d",
                    },
                  ],
                  maxAllowedSelections: 1,
                },
              },
            },
            {
              id: "row_actions",
              component: {
                Row: {
                  children: {
                    explicitList: ["button_exit", "button_submit"],
                  },
                  distribution: "spaceBetween",
                },
              },
            },
            {
              id: "text_exit",
              component: {
                Text: {
                  text: {
                    literalString: "Exit Quiz",
                  },
                },
              },
            },
            {
              id: "button_exit",
              component: {
                Button: {
                  child: "text_exit",
                  action: {
                    name: "QUIZ_RESPONSE",
                    context: [
                      {
                        key: "selected_option_id",
                        value: {
                          literalString: "",
                        },
                      },
                      {
                        key: "exit_requested",
                        value: {
                          literalBoolean: true,
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              id: "text_submit",
              component: {
                Text: {
                  text: {
                    literalString: "Submit Answer",
                  },
                },
              },
            },
            {
              id: "button_submit",
              component: {
                Button: {
                  child: "text_submit",
                  action: {
                    name: "QUIZ_RESPONSE",
                    context: [
                      {
                        key: "selected_option_id",
                        value: {
                          path: "/selection_results/0",
                        },
                      },
                      {
                        key: "exit_requested",
                        value: {
                          literalBoolean: false,
                        },
                      },
                    ],
                  },
                  primary: true,
                },
              },
            },
          ],
        },
      },
      {
        beginRendering: {
          root: "root_column",
          surfaceId: "quiz_question_surface",
        },
      },
    ];

    async function renderExampleData(): Promise<Array<unknown> | undefined> {
      const prompt = getUIDataUpdatePrompt([
        llm`This is the objective: ${objective}`.asContent(),
        llm`This is the UI that was generated: ${JSON.stringify(quizQuestionSurface)}`.asContent(),
      ]);

      const ui = await generateContent(
        "gemini-flash-latest",
        prompt,
        moduleArgs
      );
      if (!ok(ui)) {
        console.log("ERROR", ui.$error);
        exit(-1);
      }

      return toJson<unknown[]>([ui.candidates.at(0)!.content!]);
    }

    const dataUpdate = await renderExampleData();
    if (!dataUpdate) {
      console.log("No data generated");
      return;
    }
    return [{ a2ui: [...quizQuestionSurface, ...dataUpdate] }];
  });
});
