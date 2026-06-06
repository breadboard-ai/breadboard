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

export type NotebooklmGetSourceParams = {
  notebook_id: string;
  source_id: string;
  task_id?: string;
  status_update: string;
};

export type NotebooklmGetSourceResponse = {
  source: {
    name: string;
    display_name?: string;
    state?: string;
    original_mime_type?: string;
    user_drive_source_status?: string;
    user_raw_source?: {
      blobstore_content?: {
        blob_id: string;
      };
      serving_url?: string;
      download_url?: string;
    };
  };
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
  },
  {
    "name": "notebooklm_get_source",
    "description": "Gets details and content of a specific source document within a NotebookLM notebook.",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "notebook_id": {
          "type": "string",
          "description": "The NotebookLM notebook ID. Extract this from the NotebookLM URL by taking the ID after \"https://notebooklm.google.com/notebook/\". For example, if the URL is \"https://notebooklm.google.com/notebook/abc123\", pass \"abc123\" as the notebook_id."
        },
        "source_id": {
          "type": "string",
          "description": "The ID of the source within the notebook."
        },
        "task_id": {
          "type": "string"
        },
        "status_update": {
          "type": "string",
          "description": "A status update to show in the UI that provides more detail on the reason why this function was called.\n  \n  For example, \"Retrieving source document\", \"Reading file contents\", etc."
        }
      },
      "required": [
        "notebook_id",
        "source_id",
        "status_update"
      ],
      "additionalProperties": false
    },
    "responseJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "source": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "The resource name of the source"
            },
            "display_name": {
              "type": "string",
              "description": "The display name of the source"
            },
            "state": {
              "type": "string",
              "description": "State of the source processing"
            },
            "original_mime_type": {
              "type": "string",
              "description": "The original mime type of the source document"
            },
            "user_drive_source_status": {
              "type": "string",
              "description": "The status of user drive source document"
            },
            "user_raw_source": {
              "type": "object",
              "description": "Details and contents of the raw source document.",
              "properties": {
                "blobstore_content": {
                  "type": "object",
                  "description": "GCS blob details for the source document.",
                  "properties": {
                    "blob_id": {
                      "type": "string",
                      "description": "The unique ID of the source document stored in GCS."
                    }
                  },
                  "required": [
                    "blob_id"
                  ],
                  "additionalProperties": false
                },
                "serving_url": {
                  "type": "string",
                  "description": "The temporary serving URL of the source document."
                },
                "download_url": {
                  "type": "string",
                  "description": "The download URL of the source document."
                }
              },
              "additionalProperties": false
            }
          },
          "required": [
            "name"
          ],
          "additionalProperties": true
        }
      },
      "required": [
        "source"
      ],
      "additionalProperties": false
    }
  }
];

export const metadata: Record<string, { icon?: string; title?: string }> = {
  "notebooklm_retrieve_relevant_chunks": {},
  "notebooklm_generate_answer": {},
  "notebooklm_get_source": {}
};

export const instruction: string = "## Using NotebookLM\n\nYou have access to NotebookLM notebooks as knowledge sources. When the objective\nreferences a NotebookLM notebook (indicated by a URL like\nhttps://notebooklm.google.com/notebook/{notebook_id}), you can:\n\n1. Use \"notebooklm_generate_answer\" to generate a comprehensive answer to a\n   question using the notebook's AI chat functionality. This is useful when you\n   need the notebook to synthesize information and provide a direct answer.\n\n2. Use \"notebooklm_retrieve_relevant_chunks\" to retrieve relevant source\n   material from the notebook (text, images, or audio) based on a query. This is\n   useful when you want to retrieve source documents/content, not just get a\n   summary (use this like a RAG system for the notebook content). Each retrieval\n   is limited to a token budget, so it may be necessary to make multiple more\n   narrow queries if you need more information.\n\n3. Use \"notebooklm_get_source\" to retrieve to retrieve complete source material\n   from the notebook (text, images, or audio) that was referenced in the query.\n   This is useful when you want to retrieve the complete source\n   documents/content, not just get a small chunk of the source.\n\nThe URL format is \"https://notebooklm.google.com/notebook/{notebook_id}\" where\n\"{notebook_id}\" is the ID you should pass to the function.";
