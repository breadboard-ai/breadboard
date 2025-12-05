/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { BuiltInClient } from "../built-in-client.js";
import { McpBuiltInClientFactory } from "../types.js";
import { mcpErr, mcpText } from "../utils.js";
import { FileSystemReadWritePath, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";

export { createFileSystemClient };

const createFileSystemClient: McpBuiltInClientFactory = ({ fileSystem }) => {
  const client = new BuiltInClient({
    name: "File System",
    url: "builtin:filesystem",
  });

  client.addTool(
    "filesystem_read_file",
    {
      title: "Read file",
      description: "Reads contents of a file",
      inputSchema: {
        path: z
          .string()
          .describe(
            `Path to the file in the virtual file system. Must be absolute path starting from the root`
          ),
        storeInBuffer: z
          .boolean()
          .describe(
            `Optional. A flag that controls how to handle the retrieving contents of the files.
  
  When "true", retrieves and saves the contents of the files for later examination. Use "true" when the prompt instructs to only retrieve or load contents. This is the most common case.

  When "false", retrieves and includes the contents of the files alongside the response. Use this mode when the prompt includes instructions to do additional work with the contents of the files. This is the default value.

  Examples of prompts and modes inferred from prompts:

   - "Get the contents of file at /path/to/file -> storeInBuffer = "true", because the prompt only asks to retrieve the contents.
   - "Load file "/path/to/file" and summarize their contents" -> storeInBuffer = "false", because the prompts contains instructions for additional work ("summarize their contents")
   - "Load file ... and answer this question ... " -> storeInBuffer = "false", because the prompt contains instructions for additional work ("answer this question ...")
 `
          )
          .optional(),
      },
    },
    async ({ path, storeInBuffer }) => {
      const resolvingPath = resolvePath(path);
      if (!ok(resolvingPath)) {
        return mcpErr(resolvingPath.$error);
      }
      const reading = await fileSystem.read({ path: resolvingPath });
      if (!ok(reading)) {
        return mcpErr(reading.$error);
      }
      // TODO: Handle multimodal content.
      const text = reading.data
        ?.flatMap((content) => {
          return content.parts
            .map((part) => {
              if ("text" in part) {
                return part.text;
              }
              return null;
            })
            .filter(Boolean);
        })
        .join("\n\n");
      if (!text) {
        return mcpErr(`No text found in file`);
      }
      return mcpText(text, storeInBuffer);
    }
  );

  client.addTool(
    "filesystem_append_text_to_file",
    {
      title: "Append text to file",
      description:
        "Appends text to an existing file. If a file does not exists, creates it first",
      inputSchema: {
        path: z
          .string()
          .describe(
            `Path to the file in the virtual file system. Must be absolute path starting from the root`
          ),
        text: z
          .string()
          .describe(
            `Text to write to the file. Unless otherwise specified, use markdown for formatting the text`
          ),
      },
    },
    async ({ path, text }) => {
      const resolvingPath = resolvePath(path);
      if (!ok(resolvingPath)) {
        return mcpErr(resolvingPath.$error);
      }
      const writing = await fileSystem.write({
        path: resolvingPath,
        append: true,
        data: [
          {
            parts: [{ text }],
          },
        ],
      });
      if (!ok(writing)) {
        return mcpErr(writing.$error);
      }
      return mcpText(`Successfully appended to "${path}"`);
    }
  );

  client.addTool(
    "filesystem_delete_file",
    {
      title: "Delete file",
      description: "Deletes an existing file.",
      inputSchema: {
        path: z
          .string()
          .describe(
            `Path to the file in the virtual file system. Must be absolute path starting from the root`
          ),
        quiet: z
          .boolean()
          .describe(
            `When set to "true", will not raise an error if the file does not exist. The default value is "false"`
          )
          .optional(),
      },
    },
    async ({ path, quiet }) => {
      const resolvingPath = resolvePath(path);
      if (!ok(resolvingPath)) {
        return mcpErr(resolvingPath.$error);
      }

      const deleting = await fileSystem.write({
        path: resolvingPath,
        delete: true,
      });
      if (!ok(deleting) && !quiet) {
        return mcpErr(deleting.$error);
      }
      return mcpText(`Successfully deleted "${path}"`);
    }
  );

  return client;
};

function resolvePath(path: string): Outcome<FileSystemReadWritePath> {
  if (!path.startsWith("/")) {
    return err(`Invalid path "${path}". All paths must start from the root`);
  }
  return `/local/${path.slice(1)}`;
}
