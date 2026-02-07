/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import z from "zod";
import { tr } from "../../a2/utils.js";
import {
  defineFunction,
  FunctionDefinition,
  mapDefinitions,
} from "../function-definition.js";
import { AgentFileSystem } from "../file-system.js";
import { FunctionGroup } from "../types.js";
import { statusUpdateSchema, taskIdSchema } from "./system.js";
import { TaskTreeManager } from "../task-tree-manager.js";
import {
  ApplicationPlatform,
  ContentPiece,
  DeviceType,
  NotebookLmApiClient,
  OriginProductType,
  ResponseContentType,
  RetrieveRelevantChunksResponse,
  SourceContext,
} from "../../../sca/services/notebooklm-api-client.js";

export { getNotebookLMFunctionGroup };

const NOTEBOOKLM_RETRIEVE_CHUNKS_FUNCTION =
  "notebooklm_retrieve_relevant_chunks";

const NOTEBOOKLM_GENERATE_ANSWER_FUNCTION = "notebooklm_generate_answer";

export type NotebookLMFunctionArgs = {
  notebookLmApiClient: NotebookLmApiClient;
  taskTreeManager: TaskTreeManager;
  fileSystem: AgentFileSystem;
};

const instruction = tr`

## Using NotebookLM

You have access to NotebookLM notebooks as knowledge sources. When the objective
references a NotebookLM notebook (indicated by a URL like
https://notebooklm.google.com/notebook/{notebook_id}), you can:

1. Use "${NOTEBOOKLM_GENERATE_ANSWER_FUNCTION}" to generate a comprehensive answer 
   to a question using the notebook's AI chat functionality. This is useful when 
   you need the notebook to synthesize information and provide a direct answer.

2. Use "${NOTEBOOKLM_RETRIEVE_CHUNKS_FUNCTION}" to retrieve relevant source
   material from the notebook (text, images, or audio) based on a query. This is
   useful when you want to retrieve source documents/content, not jsut get a
   summary (use this like a RAG system for the notebook content).  Each
   retrieval is limited to a token budget, so it may be useful to make multiple
   more narrow queries if you need more information.

The URL format is "https://notebooklm.google.com/notebook/{notebook_id}" where 
"{notebook_id}" is the ID you should pass to the function.
`;

function getNotebookLMFunctionGroup(
  args: NotebookLMFunctionArgs
): FunctionGroup {
  return {
    ...mapDefinitions(defineNotebookLMFunctions(args)),
    instruction,
  };
}

/**
 * Converts ContentPieces from the API response to text content and file paths.
 * Text is returned as strings, media is stored in the file system and paths are returned.
 */
function processContentPieces(
  pieces: ContentPiece[],
  fileSystem: AgentFileSystem
): {
  textContent: string[];
  mediaPaths: string[];
  errors: string[];
} {
  const textContent: string[] = [];
  const mediaPaths: string[] = [];
  const errors: string[] = [];

  const addToFileSystem = (part: DataPart): void => {
    const path = fileSystem.add(part);
    if (ok(path)) {
      mediaPaths.push(path);
    } else {
      errors.push(path.$error);
    }
  };

  for (const piece of pieces) {
    if (piece.text !== undefined) {
      textContent.push(piece.text);
    }

    if (piece.image) {
      const mimeType = piece.image.mimeType ?? "image/png";
      if (piece.image.blobId) {
        const handle = new URL(
          `/board/blobs/${piece.image.blobId}`,
          window.location.href
        ).href;
        addToFileSystem({
          storedData: { handle, mimeType },
        });
      } else if (piece.image.url) {
        addToFileSystem({
          fileData: { fileUri: piece.image.url, mimeType },
        });
      } else if (piece.image.data) {
        addToFileSystem({ inlineData: { data: piece.image.data, mimeType } });
      }
    }

    if (piece.audio) {
      const mimeType = piece.audio.mimeType ?? "audio/mpeg";
      if (piece.audio.blobId) {
        const handle = new URL(
          `/board/blobs/${piece.audio.blobId}`,
          window.location.href
        ).href;
        addToFileSystem({
          storedData: { handle, mimeType },
        });
      } else if (piece.audio.url) {
        addToFileSystem({
          fileData: { fileUri: piece.audio.url, mimeType },
        });
      } else if (piece.audio.data) {
        addToFileSystem({ inlineData: { data: piece.audio.data, mimeType } });
      }
    }
  }

  return { textContent, mediaPaths, errors };
}

function defineNotebookLMFunctions(
  args: NotebookLMFunctionArgs
): FunctionDefinition[] {
  const { notebookLmApiClient, taskTreeManager, fileSystem } = args;

  return [
    defineFunction(
      {
        name: NOTEBOOKLM_RETRIEVE_CHUNKS_FUNCTION,
        svgIcon:
          "var(--bb-icon-notebooklm, url(/third_party/icons/notebooklm.svg))",
        description: tr`Retrieves relevant source data from a NotebookLM notebook 
based on a query. Use this to query knowledge stored in NotebookLM notebooks.`,
        parameters: {
          notebook_id: z.string().describe(
            tr`The NotebookLM notebook ID. Extract this from the NotebookLM URL by 
taking the ID after "https://notebooklm.google.com/notebook/". For example, if the 
URL is "https://notebooklm.google.com/notebook/abc123", pass "abc123" as the notebook_id.`
          ),
          query: z.string().describe(
            tr`The query to search for relevant content in the notebook. Be 
specific about what information you're looking for.`
          ),
          ...taskIdSchema,
          ...statusUpdateSchema,
        },
        response: {
          chunks: z
            .array(
              z.object({
                source_name: z
                  .string()
                  .describe("The resource name of the source"),
                source_display_name: z
                  .string()
                  .optional()
                  .describe("The display name of the source"),
                source_create_time: z
                  .string()
                  .optional()
                  .describe("Timestamp when the source was created"),
                text_content: z
                  .array(z.string())
                  .describe("The text content from the chunk"),
                media_paths: z
                  .array(z.string())
                  .optional()
                  .describe(
                    "File paths for multimodal content (images, audio) stored in the agent file system"
                  ),
              })
            )
            .describe("The relevant chunks retrieved from the notebook"),
        },
      },
      async ({ notebook_id, query, task_id, status_update }) => {
        taskTreeManager.setInProgress(task_id, status_update);

        try {
          const response: RetrieveRelevantChunksResponse =
            await notebookLmApiClient.retrieveRelevantChunks({
              name: `notebooks/${notebook_id}`,
              query,
              // TODO: decide what to do about budget
              contextTokenBudget: 1000000,
              provenance: {
                originProductType: OriginProductType.GOOGLE_NOTEBOOKLM_EVALS,
                clientInfo: {
                  applicationPlatform: ApplicationPlatform.WEB,
                  device: DeviceType.DESKTOP,
                },
              },
            });

          // Format the response for LLM consumption
          // Store media in file system and return paths so Gemini can reference them
          const allErrors: string[] = [];
          const chunks = response.sourceContexts.flatMap(
            (sourceContext: SourceContext) =>
              sourceContext.chunks.map((chunk) => {
                const { textContent, mediaPaths, errors } =
                  processContentPieces(chunk.content?.pieces ?? [], fileSystem);
                allErrors.push(...errors);
                return {
                  source_name: sourceContext.sourceName,
                  source_display_name: sourceContext.source?.displayName,
                  source_create_time: sourceContext.source?.createTime,
                  text_content: textContent,
                  media_paths: mediaPaths.length > 0 ? mediaPaths : undefined,
                };
              })
          );

          if (allErrors.length > 0) {
            return err(`Failed to store media: ${allErrors.join(", ")}`);
          }

          return { chunks };
        } catch (error) {
          return err(
            `Failed to retrieve chunks from notebook: ${(error as Error).message}`
          );
        }
      }
    ),
    defineFunction(
      {
        name: NOTEBOOKLM_GENERATE_ANSWER_FUNCTION,
        svgIcon:
          "var(--bb-icon-notebooklm, url(/third_party/icons/notebooklm.svg))",
        description: tr`Generates an answer to a question using a NotebookLM notebook's
    chat functionality. The notebook's AI will synthesize information from its sources
    to provide a comprehensive answer. Use this when you need a direct answer rather
    than raw chunks of content.`,
        parameters: {
          notebook_id: z.string().describe(
            tr`The NotebookLM notebook ID. Extract this from the NotebookLM URL by
    taking the ID after "https://notebooklm.google.com/notebook/". For example, if the
    URL is "https://notebooklm.google.com/notebook/abc123", pass "abc123" as the notebook_id.`
          ),
          query: z.string().describe(
            tr`The question to ask the notebook. Be specific about what
    information you're looking for.`
          ),
          ...taskIdSchema,
          ...statusUpdateSchema,
        },
        response: {
          answer: z
            .string()
            .describe("The generated answer in markdown format"),
        },
      },
      async ({ notebook_id, query, task_id, status_update }) => {
        taskTreeManager.setInProgress(task_id, status_update);

        try {
          const sessionId = "defaultChatSession";
          const response = await notebookLmApiClient.generateAnswer({
            name: `notebooks/${notebook_id}/chatSessions/${sessionId}`,
            query,
            responseContentType: ResponseContentType.MARKDOWN,
            provenance: {
              originProductType: OriginProductType.GOOGLE_NOTEBOOKLM_EVALS,
              clientInfo: {
                applicationPlatform: ApplicationPlatform.WEB,
                device: DeviceType.DESKTOP,
              },
            },
          });

          return { answer: response.markdownContent || "" };
        } catch (error) {
          return err(
            `Failed to generate answer from notebook: ${(error as Error).message}`
          );
        }
      }
    ),
  ];
}
