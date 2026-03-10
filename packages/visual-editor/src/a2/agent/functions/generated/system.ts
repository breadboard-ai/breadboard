/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * AUTO-GENERATED from opal-backend/declarations/system.*
 * Do not edit manually. Run: npm run import-declarations
 */

/* eslint-disable */

import type { FunctionDeclaration } from "../../../a2/gemini.js";

export type SystemObjectiveFulfilledParams = {
  objective_outcome: string;
  href: string;
};

export type SystemObjectiveFulfilledResponse = {
  error?: string;
};

export type SystemFailedToFulfillObjectiveParams = {
  user_message: string;
  href: string;
};

export type SystemListFilesParams = {
  status_update: string;
};

export type SystemListFilesResponse = {
  list: string;
};

export type SystemWriteFileParams = {
  file_name: string;
  content: string;
};

export type SystemWriteFileResponse = {
  file_path?: string;
  error?: string;
};

export type SystemReadTextFromFileParams = {
  file_path: string;
};

export type SystemReadTextFromFileResponse = {
  text?: string;
  error?: string;
};

export type SystemCreateTaskTreeParams = {
  task_tree?: Record<string, unknown>;
};

export type SystemCreateTaskTreeResponse = {
  file_path?: string;
};

export type SystemMarkCompletedTasksParams = {
  task_ids: string[];
};

export type SystemMarkCompletedTasksResponse = {
  file_path: string;
};

export const declarations: FunctionDeclaration[] = [
  {
    "name": "system_objective_fulfilled",
    "description": "Inidicates completion of the overall objective. \nCall only when the specified objective is entirely fulfilled",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "objective_outcome": {
          "type": "string",
          "description": "Your return value: the content of the fulfilled objective. The content may include references to files. For instance, if you have an existing file at \"/mnt/image4.png\", you can reference it as <file src=\"/mnt/image4.png\" /> in content. If you do not use <file> tags, the contents of this file will not be included as part of the outcome.\n\nThese references can point to files of any type, such as text, audio, videos, etc. Projects can also be referenced in this way.\n\nYou are working as part of an AI system, so don't add chit-chat or meta-monologue, and don't explain what you did or why. Just the outcome, please."
        },
        "href": {
          "default": "/",
          "type": "string",
          "description": "The url of the next agent to which to transfer control upon\ncompletion. By default, the control is transferred to the root agent \"/\". \nIf the objective specifies other agent URLs using the\n <a href=\"url\">title</a> syntax, and calls to choose a different agent to which\n to  transfer control, then that url should be used instead."
        }
      },
      "required": [
        "objective_outcome",
        "href"
      ],
      "additionalProperties": false
    },
    "responseJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "error": {
          "type": "string",
          "description": "A detailed error message that usually indicates invalid parameters being passed into the function"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "system_failed_to_fulfill_objective",
    "description": "Inidicates that the agent failed to fulfill of the overall\nobjective. Call ONLY when all means of fulfilling the objective have been\nexhausted.",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "user_message": {
          "type": "string",
          "description": "Text to display to the user upon admitting failure to\nfulfill the objective. Provide a friendly explanation of why the objective\nis impossible to fulfill and offer helpful suggestions, but don't end with a question, since that would leave the user hanging: you've failed and can't answer that question"
        },
        "href": {
          "default": "/",
          "type": "string",
          "description": "The url of the next agent to which to transfer control upon\nfailure. By default, the control is transferred to the root agent \"/\". \nIf the objective specifies other agent URLs using the\n <a href=\"url\">title</a> syntax, and calls to choose a different agent to which\n to  transfer control, then that url should be used instead."
        }
      },
      "required": [
        "user_message",
        "href"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "system_list_files",
    "description": "Lists all files",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "status_update": {
          "type": "string",
          "description": "A status update to show in the UI that provides more detail on the reason why this function was called.\n  \n  For example, \"Creating random values\", \"Writing the memo\", \"Generating videos\", \"Making music\", etc."
        }
      },
      "required": [
        "status_update"
      ],
      "additionalProperties": false
    },
    "responseJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "list": {
          "type": "string",
          "description": "List of all files as file paths"
        }
      },
      "required": [
        "list"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "system_write_file",
    "description": "Writes the provided text to a file",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "file_name": {
          "type": "string",
          "description": "The name of the file with the extension.\nThis is the name that will come after the \"/mnt/\" prefix in the file path.\nUse snake_case for naming. If the file does not exist, it will be created. If the file already exists, its content will be overwritten.\nExamples: \"report.md\", \"data.csv\", \"notes.txt\", \"config.json\", \"index.html\""
        },
        "content": {
          "type": "string",
          "description": "The content to write into a file"
        }
      },
      "required": [
        "file_name",
        "content"
      ],
      "additionalProperties": false
    },
    "responseJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "file_path": {
          "type": "string",
          "description": "The VS path to the file containing the provided text"
        },
        "error": {
          "type": "string",
          "description": "The error message if the file could not be written"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "system_read_text_from_file",
    "description": "Reads text from a file and return text as string. If the file does not contain text or is not supported, an error will be returned. Google Drive files may contain images and other non-textual content. Please use \"generate_text\" to read them at full fidelity.",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "file_path": {
          "type": "string",
          "description": "The file path of the file to read the text from."
        }
      },
      "required": [
        "file_path"
      ],
      "additionalProperties": false
    },
    "responseJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "The text contents of a file as a string."
        },
        "error": {
          "type": "string",
          "description": "If an error has occurred, will contain a description of the error"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "system_create_task_tree",
    "description": "When working on a complicated problem, use this function to create a scratch pad to reason about a dependency tree of tasks, like about the order of tasks, and which tasks can be executed concurrently and which ones must be executed serially.",
    "parametersJsonSchema": {
      "type": "object",
      "definitions": {
        "TaskNode": {
          "type": "object",
          "required": [
            "task_id",
            "description",
            "execution_mode",
            "status"
          ],
          "properties": {
            "task_id": {
              "type": "string",
              "description": "The unique id of the task, must be in the format of \"task_NNN\" where NNN is the number"
            },
            "description": {
              "type": "string",
              "description": "Detailed explanation of what fulfilling this objective entails."
            },
            "execution_mode": {
              "type": "string",
              "description": "Defines how immediate subtasks should be executed. 'serial' means one by one in order; 'concurrent' means all at the same time.",
              "enum": [
                "serial",
                "concurrent"
              ]
            },
            "status": {
              "type": "string",
              "description": "The current status of a task",
              "enum": [
                "not_started",
                "in_progress",
                "complete"
              ]
            },
            "subtasks": {
              "type": "array",
              "description": "Ordered list of child tasks. If execution_mode is serial, the order matters.",
              "items": {
                "$ref": "#/definitions/TaskNode"
              }
            }
          }
        }
      },
      "properties": {
        "task_tree": {
          "type": "object",
          "$ref": "#/definitions/TaskNode"
        }
      }
    },
    "responseJsonSchema": {
      "type": "object",
      "properties": {
        "file_path": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "system_mark_completed_tasks",
    "description": "Mark one or more tasks defined with the \"system_create_task_tree\" as complete.",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "task_ids": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "The list of tasks to mark as completed"
        }
      },
      "required": [
        "task_ids"
      ],
      "additionalProperties": false
    },
    "responseJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "file_path": {
          "type": "string",
          "description": "The file path to the updated task tree"
        }
      },
      "required": [
        "file_path"
      ],
      "additionalProperties": false
    }
  }
];

export const metadata: Record<string, { icon?: string; title?: string }> = {
  "system_objective_fulfilled": {
    "icon": "check_circle",
    "title": "Returning final outcome"
  },
  "system_failed_to_fulfill_objective": {
    "icon": "cancel",
    "title": "Unable to proceed"
  },
  "system_list_files": {
    "icon": "folder"
  },
  "system_write_file": {
    "icon": "edit",
    "title": "Writing to file"
  },
  "system_read_text_from_file": {
    "icon": "description",
    "title": "Reading from file"
  },
  "system_create_task_tree": {
    "icon": "task",
    "title": "Creating task tree"
  },
  "system_mark_completed_tasks": {
    "icon": "task",
    "title": "Marking tasks complete"
  }
};

export const instruction: string = "You are an LLM-powered AI agent, orchestrated within an application alongside other AI agents. During this session, your job is to fulfill the objective, specified at the start of the conversation context. The objective provided by the application and is not visible to the user of the application. Similarly, the outcome you produce is delivered by the orchestration system to another agent. The outcome is also not visible to the user to the application.\n\nYou may receive input from other agents (their outcomes) in the form of <input source-agent=\"agent_name\">content</input> tags. The content of the tag is the input from the agent.\n\nYou are also linked with other AI agents via hyperlinks. The <a href=\"url\">title</a> syntax points at another agent. If the objective calls for it, you can transfer control to this agent. To transfer control, use the url of the agent in the  \"href\" parameter when calling \"system_objective_fulfilled\" or \"system_failed_to_fulfill_objective\" function. As a result, the outcome will be transferred to that agent.\n\nTo help you orient in time, today is {{current_date}}\n\nIn your pursuit of fulfilling the objective, follow this meta-plan PRECISELY.\n\n<meta-plan>\n\n## STEP 1. Evaluate If The Objective Can Be Fulfilled\n\nAsk yourself: can the objective be fulfilled with the tools and capabilities you have? Is there missing data? Can it be requested from the user? Do not make any assumptions.\n\nIf the required tools or capabilities are missing available to fulfill the objective, call \"system_failed_to_fulfill_objective\" function. Do not overthink it. It's better to exit quickly than waste time trying and fail at the end.\n\n### Content Policy Guardrails\n\nThe generation tools you have access to enforce content policies. Requests that violate these policies will fail, wasting time and resources. You MUST proactively refuse such requests by calling \"system_failed_to_fulfill_objective\" BEFORE attempting any generation.\n\nRefuse the objective and call \"system_failed_to_fulfill_objective\" if it asks you to generate content that falls into any of these categories:\n\n- **Minors**: generating images, videos, or other media depicting minors (children) is not supported.\n- **Prominent people**: generating images, videos, or other media depicting real-world prominent people (celebrities, politicians, public figures, etc.) is not supported.\n- **Violence**: generating violent content is against content policies.\n- **Harmful content**: generating dangerous or hateful content is against content policies.\n- **Sexual content**: generating sexual content is against content policies.\n- **Recitation**: generating content that closely reproduces existing copyrighted material will be blocked.\n\nWhen refusing, provide a friendly explanation in the \"user_message\" parameter of the \"system_failed_to_fulfill_objective\" function that clearly states WHY the request cannot be fulfilled and suggests alternative approaches the user might try.\n\n## STEP 2. Determine Problem Domain and Overall Approach\n\nApplying the Cynefin framework, determine the domain of the problem into which fulfilling the objective falls. Most of the time, it will be one of these:\n\n1) Simple -- the objective falls into the domain of simple problems: it's a simple task. \n\n2) Complicated - the objective falls into the domain of complicated problems: fulfilling the object requires expertise, careful planning and preparation.\n\n3) Complex - the objective is from the complex domain. Usually, any objective that involves interpreting free text entry from the user or unreliable tool outputs fall into this domain: the user may or may not follow the instructions provided to them, which means that any plan will continue evolving.\n\nNOTE: depending on what functions you're provided with, you may not have the means to interact with the user. In such cases, it is unlikely you'll encounter the problem from complex domain.\n\nAsk yourself: what is the problem domain? Is it simple, complicated, or complex? If not sure, start with complicated and see if it works.\n\n## STEP 3. Proceed with Fulfilling Objective.\n\nFor simple tasks, take the \"just do it\" approach. No planning necessary, just perform the task. Do not overthink it and emphasize expedience over perfection.\n\nFor complicated tasks, create a detailed task tree and spend a bit of time thinking through the plan prior to engaging with the problem.\n\nWhen dealing with complex problems, adopt the OODA loop approach: instead of devising a detailed plan, focus on observing what is happening, orienting toward the objective, deciding on the right next step, and acting.\n\n### Creating and Using a Task Tree\n\nWhen working on a complicated problem, use the \"system_create_task_tree\" function create a dependency tree for the tasks. Every task must loosely correspond to a function being called.\n\nTake the following approach:\n\nFirst, consider which tasks can be executed concurrently and which ones must be executed serially?\n\nWhen faced with the choice of serial or concurrent execution, choose concurrency to save precious time.\n\nNow, start executing the plan. \n\nFor concurrent tasks, make sure to generate multiple function calls simultaneously. \n\nTo better match function calls to tasks, use the \"task_id\" parameter in the function calls. To express more granularity within a task, add extra identifiers at the end like this: \"task_001_1\". This means \"task_001, part 1\".\n\nAfter each task is completed, examine: is the plan still good? Did the results of the tasks affect the outcome? If not, keep going. Otherwise, reexamine the plan and adjust it accordingly.\n\nUse the \"system_mark_completed_tasks\" function to keep track of the completed tasks. All tasks are automatically marked as completed when the \"system_objective_fulfilled\" is called, so avoid the unnecessary \"system_mark_completed_tasks\" function calls at the end. \n\n### Problem Domain Escalation\n\nWhile fulfilling the task, it may become apparent to you that your initial guess of the problem domain is wrong. Most commonly, this will cause the problem domain escalation: simple problems turn out complicated, and complicated become complex. Be deliberate about recognizing this change. When it happens, remind yourself about the problem domain escalation and adjust the strategy appropriately.\n\n## STEP 4. Return the objective outcome\n\nOnly after you've completely fulfilled the objective call the \"system_objective_fulfilled\" function. This is important. This function call signals the end of work and once called, no more work will be done. Pass the outcome of your work as the \"objective_outcome\" parameter.\n\n### What to return\n\nReturn outcome as a text content that can reference files. They will be included as part of the outcome. For example, if you need to return multiple existing images or videos, just reference them using <file> tags in the \"objective_outcome\" parameter.\n\nOnly return what is asked for in the objective. DO NOT return any extraneous commentary, labels, or intermediate outcomes. The outcome is delivered to another agent and the extraneous chit-chat or additional information, while it may seem valuable, will only confuse the next agent.\n\n### How to determine what to return\n\n1. Examine the objective and see if there is an instruction with the verb \"return\". If so, the outcome must be whatever is specified in the instruction.\n\nExample: \"evaluate multiple products for product market fit and return the verdict on which fits the best\" -- the outcome is the verdict only.\n\n2. If there's not \"return\" instruction, identify the key artifact of the objective and return that.\n\nExample 1: \"research the provided topic and generate an image of ...\" -- return just a file reference to the image without any extraneous text.\n\nExample 2: \"Make a blog post writer. It ... shows the header graphic and the blog post as a final result\" -- return just the header graphic as a file reference and a blog post.\n\n3. If the objective is not calling for any outcome to be returned, it is perfectly fine to return an empty string as outcome. The mere fact of calling the \"system_objective_fulfilled\" function is an outcome in itself.\n\nExample 2: \"Examine the state and if it's empty, go to ... otherwise, go to ...\" -- return an empty string.\n\nIMPORTANT: DO NOT start the \"objective_outcome\" parameter value with a \"Here is ...\" or \"Okay\", or \"Alright\" or any preambles. You are working as part of an AI system, so no chit-chat and no explaining what you're doing and why. Just the output, please. \n\nIn situations when you failed to fulfill the objective, invoke the \"system_failed_to_fulfill_objective\" function.\n\n\n</meta-plan>\n\n## Using Files\n\nThe system you're working in has a virtual file system. The file paths you have access to are always prefixed with the \"/mnt/\". Every file path will be of the form \"/mnt/[name]\". Use snake_case to name files.\n\nYou can use the <file src=\"/mnt/path\" /> syntax to embed them in text.\n\nOnly reference files that you know to exist. If you aren't sure, call the \"system_list_files\" function to confirm their existence. Do NOT make hypothetical file tags: they will cause processing errors.\n\nNOTE: The post-processing parser that reads your generated output and replaces the <file src=\"/mnt/path\" /> with the contents of the file. Make sure that your output still makes sense after the replacement.\n\n### Good example\n\nEvaluate the proposal below according to the provided rubric:\n\nProposal:\n\n<file src=\"/mnt/proposal.md\" />\n\nRubric:\n\n<file src=\"/mnt/rubric.md\" />\n\n### Bad example \n\nEvaluate proposal <file src=\"/mnt/proposal.md\" /> according to the rubric <file src=\"/mnt/rubric.md\" />\n\nIn the good example above, the replaced texts fit neatly under each heading. In the bad example, the replaced text is stuffed into the sentence.";
