/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * AUTO-GENERATED from opal-backend/declarations/memory.*
 * Do not edit manually. Run: npm run import-declarations
 */

/* eslint-disable */

import type { FunctionDeclaration } from "../../../a2/gemini.js";

export type MemoryCreateSheetParams = {
  name: string;
  columns: string[];
  task_id?: string;
  status_update: string;
};

export type MemoryReadSheetParams = {
  range: string;
  file_name?: string;
  output_format: "file" | "json";
  task_id?: string;
  status_update: string;
};

export type MemoryReadSheetResponse = {
  file_path?: string;
  json?: string;
  error?: string;
};

export type MemoryUpdateSheetParams = {
  range: string;
  values: string[][];
  task_id?: string;
};

export type MemoryDeleteSheetParams = {
  name: string;
  task_id?: string;
  status_update: string;
};

export type MemoryGetMetadataParams = {
  task_id?: string;
  status_update: string;
};

export type MemoryGetMetadataResponse = {
  sheets?: ({
    name: string;
    file_path: string;
    columns: string[];
  })[];
  error?: string;
};

export const declarations: FunctionDeclaration[] = [
  {
    "name": "memory_create_sheet",
    "description": "Creates a new memory sheet",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name of the sheet. Use snake_case for\nnaming."
        },
        "columns": {
          "type": "array",
          "items": {
            "type": "string",
            "description": "The name of the column header"
          },
          "description": "An array of strings representing the column headers (e.g., ['Name', 'Status'])."
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
        "name",
        "columns",
        "status_update"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "memory_read_sheet",
    "description": "Reads values from a specific memory range (e.g. Scores!A1:B3)",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "range": {
          "type": "string",
          "description": "The Google Sheets range which must include the name of the sheet"
        },
        "file_name": {
          "type": "string",
          "description": "The name of the file to save the output to. This is the name that\nwill come after \"/mnt/\" prefix in the file path. Use snake_case for\nnaming. Only use when the \"output_format\" is set to \"file\"."
        },
        "output_format": {
          "type": "string",
          "enum": [
            "file",
            "json"
          ],
          "description": "The output format. When \"file\" is specified, the output will be saved as a file and the \"file_path\" response parameter will be provided as output. Use this when you expect a long output from the sheet. NOTE that choosing this option will prevent you from seeing the output directly: you only get back the file path. You can read this file as a separate action, but if you do expect to read it, the \"json\" output format might be a better choice.\n\nWhen \"json\" is specified, the output will be returned as JSON directlty, and the \"json\" response parameter will be provided."
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
        "range",
        "output_format",
        "status_update"
      ],
      "additionalProperties": false
    },
    "responseJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "file_path": {
          "type": "string",
          "description": "The file path with the output of the\ngenerator. Will be provided when the \"output_format\" is set to \"file\""
        },
        "json": {
          "type": "string",
          "description": "The JSON output of the generator. Will be \nprovided when the \"output_format\" is set to \"json\""
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
    "name": "memory_update_sheet",
    "description": "Overwrites a specific memory range with new data. Used for editing specific rows.",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "range": {
          "type": "string",
          "description": "The Google Sheets range which must include the name of the sheet"
        },
        "values": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
              "type": "string",
              "description": "The data to write, may include references to files. For instance, if you have an existing file at \"/mnt/text3.md\", you can reference it as <file src=\"/mnt/text3.md\" /> in the in data. At update time, the tag will be replaced with the file contents."
            }
          },
          "description": "The 2D array of data to write."
        },
        "task_id": {
          "type": "string"
        }
      },
      "required": [
        "range",
        "values"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "memory_delete_sheet",
    "description": "Deletes a specific memory sheet",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name of the sheet"
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
        "name",
        "status_update"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "memory_get_metadata",
    "description": "Returns the names and header rows of all memory sheets.",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "task_id": {
          "type": "string"
        },
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
        "sheets": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "description": "The name of the memory sheet"
              },
              "file_path": {
                "type": "string",
                "description": "The file path to read the memory sheet"
              },
              "columns": {
                "type": "array",
                "items": {
                  "type": "string",
                  "description": "The column name"
                },
                "description": "The list of column names"
              }
            },
            "required": [
              "name",
              "file_path",
              "columns"
            ],
            "additionalProperties": false
          }
        },
        "error": {
          "type": "string",
          "description": "If an error has occurred, will contain a description of the error"
        }
      },
      "additionalProperties": false
    }
  }
];

export const metadata: Record<string, { icon?: string; title?: string }> = {
  "memory_create_sheet": {
    "icon": "table_chart",
    "title": "Creating a new memory sheet"
  },
  "memory_read_sheet": {
    "icon": "table_chart",
    "title": "Reading memory"
  },
  "memory_update_sheet": {
    "icon": "table_chart",
    "title": "Updating memory"
  },
  "memory_delete_sheet": {
    "icon": "table_chart",
    "title": "Deleting a memory sheet"
  },
  "memory_get_metadata": {
    "icon": "table_chart",
    "title": "Reading memory metadata"
  }
};

export const instruction: string = "## Using memory data store\n\nYou have access to a persistent data store that allows you to recall and remember data across multiple sessions. Use the data store when the objective contains the key phrase \"Use Memory\".\n\nThe data store is stored in a Google Spreadsheet. \n\nUnless the objective explicitly calls for creating new sheets and  specifies names for them, keep all memory data in a single sheet named \"memory\". Populate it with the columns that make sense for a wide range of data. Typically, you will want to include \"Date\", \"Title\", and \"Details\" columns. Look at the objective for hints on what columns to use. If there is a sheet that already exists, reuse it instead of creating a new one.\n\nCreate new sheets within this spreadsheet using the \"memory_create_sheet\" function and delete sheets with the \"memory_delete_sheet\" function. Get the list of existing sheets with the \"memory_get_metadata\" function.\n\nTo retrieve data from memory, use either the \"memory_read_sheet\" function with the standard Google Sheets ranges or read the entire sheet as a file using the \"/mnt/memory/sheet_name\" path.\n\nTo update data in memory, use the \"memory_update_sheet\" function.\n\nThe full transcript of the conversation with the user is automatically stored in a separate data store. Don't call any functions when asked to store chat logs or chat information. Just read the chat log from \"/mnt/system/chat_log.json\" whenever you need the chat history.";
