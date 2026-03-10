/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * AUTO-GENERATED from opal-backend/declarations/google-drive.*
 * Do not edit manually. Run: npm run import-declarations
 */

/* eslint-disable */

import type { FunctionDeclaration } from "../../../a2/gemini.js";

export type GoogleDriveUploadFileParams = {
  name: string;
  file_path: string;
  convert: boolean;
  parent?: string;
  status_update: string;
};

export type GoogleDriveUploadFileResponse = {
  file_path?: string;
  error?: string;
};

export type GoogleDriveCreateFolderParams = {
  name: string;
  parent?: string;
  status_update: string;
};

export type GoogleDriveCreateFolderResponse = {
  folder_id?: string;
  error?: string;
};

export const declarations: FunctionDeclaration[] = [
  {
    "name": "google_drive_upload_file",
    "description": "Uploads a file to Google Drive. Supports automatic conversion of office formats (like PPTX, DOCX, XLSX) into Google Workspace formats.",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The user-friendly name of the file that will show up in Drive list"
        },
        "file_path": {
          "type": "string",
          "description": "The file path to the file to upload."
        },
        "convert": {
          "default": true,
          "type": "boolean",
          "description": "If true, converts Office documents or CSVs into Google Docs/Slides/Sheets."
        },
        "parent": {
          "type": "string",
          "description": "The Google Drive folder that will be the parent of this newly uploaded file"
        },
        "status_update": {
          "type": "string",
          "description": "A status update to show in the UI that provides more detail on the reason why this function was called.\n  \n  For example, \"Creating random values\", \"Writing the memo\", \"Generating videos\", \"Making music\", etc."
        }
      },
      "required": [
        "name",
        "file_path",
        "convert",
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
          "description": "The file path that points at the generated Google Doc."
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
    "name": "google_drive_create_folder",
    "description": "Creates a new Google Drive folder.",
    "parametersJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The user-friendly name of the file that will show up in Drive list"
        },
        "parent": {
          "type": "string",
          "description": "The Google Drive folder that will be the parent of this newly created folder"
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
    },
    "responseJsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "folder_id": {
          "type": "string",
          "description": "The Google Drive Folder ID of the newly created folder"
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
  "google_drive_upload_file": {
    "icon": "cloud_upload",
    "title": "Uploading a File to Google Drive"
  },
  "google_drive_create_folder": {
    "icon": "folder",
    "title": "Creating a Folder in Google Drive"
  }
};

export const instruction: string | undefined = undefined;
