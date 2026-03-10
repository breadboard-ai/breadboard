/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * AUTO-GENERATED from opal-backend/declarations/notebooklm.*
 * Do not edit manually. Run: npm run import-declarations
 */

/* eslint-disable */

import type { FunctionDeclaration } from "../../../a2/gemini.js";

export type NotebooklmRetrieveRelevantChunksParams = {
  notebook_id: string;
  query: string;
  task_id?: string;
  status_update: string;
};

export type NotebooklmRetrieveRelevantChunksResponse = {
  chunks: ({
    source_name: string;
    source_display_name?: string;
    source_create_time?: string;
    text_content: string[];
    media_paths?: string[];
  })[];
};

export type NotebooklmGenerateAnswerParams = {
  notebook_id: string;
  query: string;
  task_id?: string;
  status_update: string;
};

export type NotebooklmGenerateAnswerResponse = {
  answer: string;
};

export const declarations: FunctionDeclaration[] = [
  {
    "name": "notebooklm_retrieve_relevant_chunks",
    "description": "Retrieves relevant source data from a NotebookLM notebook \nbased on a query. Use this to query knowledge stored in NotebookLM notebooks.",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "notebook_id": {
          "type": "string",
          "description": "The NotebookLM notebook ID. Extract this from the NotebookLM URL by \ntaking the ID after \"https://notebooklm.google.com/notebook/\". For example, if the \nURL is \"https://notebooklm.google.com/notebook/abc123\", pass \"abc123\" as the notebook_id."
        },
        "query": {
          "type": "string",
          "description": "The query to search for relevant content in the notebook. Be \nspecific about what information you're looking for."
        },
        "task_id": {
          "type": "string"
        },
        "status_update": {
          "type": "string",
          "description": "A status update to show in the UI that provides more detail on the reason why this function was called.\n  \n  For example, \"Creating random values\", \"Writing the memo\", \"Generating videos\", \"Making music\", etc."
        }
      },
      "required": [
        "notebook_id",
        "query",
        "status_update"
      ],
      "additionalProperties": false
    },
    "responseJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "chunks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "source_name": {
                "type": "string",
                "description": "The resource name of the source"
              },
              "source_display_name": {
                "description": "The display name of the source",
                "type": "string"
              },
              "source_create_time": {
                "description": "Timestamp when the source was created",
                "type": "string"
              },
              "text_content": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "The text content from the chunk"
              },
              "media_paths": {
                "description": "File paths for multimodal content (images, audio) stored in the agent file system",
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "source_name",
              "text_content"
            ],
            "additionalProperties": false
          },
          "description": "The relevant chunks retrieved from the notebook"
        }
      },
      "required": [
        "chunks"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "notebooklm_generate_answer",
    "description": "Generates an answer to a question using a NotebookLM notebook's\n    chat functionality. The notebook's AI will synthesize information from its sources\n    to provide a comprehensive answer. Use this when you need a direct answer rather\n    than raw chunks of content.",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "notebook_id": {
          "type": "string",
          "description": "The NotebookLM notebook ID. Extract this from the NotebookLM URL by\n    taking the ID after \"https://notebooklm.google.com/notebook/\". For example, if the\n    URL is \"https://notebooklm.google.com/notebook/abc123\", pass \"abc123\" as the notebook_id."
        },
        "query": {
          "type": "string",
          "description": "The question to ask the notebook. Be specific about what\n    information you're looking for."
        },
        "task_id": {
          "type": "string"
        },
        "status_update": {
          "type": "string",
          "description": "A status update to show in the UI that provides more detail on the reason why this function was called.\n  \n  For example, \"Creating random values\", \"Writing the memo\", \"Generating videos\", \"Making music\", etc."
        }
      },
      "required": [
        "notebook_id",
        "query",
        "status_update"
      ],
      "additionalProperties": false
    },
    "responseJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "answer": {
          "type": "string",
          "description": "The generated answer in markdown format"
        }
      },
      "required": [
        "answer"
      ],
      "additionalProperties": false
    }
  }
];

export const metadata: Record<string, { icon?: string; title?: string }> = {
  "notebooklm_retrieve_relevant_chunks": {},
  "notebooklm_generate_answer": {}
};

export const instruction: string = "## Using NotebookLM\n\nYou have access to NotebookLM notebooks as knowledge sources. When the objective\nreferences a NotebookLM notebook (indicated by a URL like\nhttps://notebooklm.google.com/notebook/{notebook_id}), you can:\n\n1. Use \"notebooklm_generate_answer\" to generate a comprehensive answer \n   to a question using the notebook's AI chat functionality. This is useful when \n   you need the notebook to synthesize information and provide a direct answer.\n\n2. Use \"notebooklm_retrieve_relevant_chunks\" to retrieve relevant source\n   material from the notebook (text, images, or audio) based on a query. This is\n   useful when you want to retrieve source documents/content, not just get a\n   summary (use this like a RAG system for the notebook content).  Each\n   retrieval is limited to a token budget, so it may be necessary to make multiple\n   more narrow queries if you need more information.\n\nThe URL format is \"https://notebooklm.google.com/notebook/{notebook_id}\" where \n\"{notebook_id}\" is the ID you should pass to the function.";
