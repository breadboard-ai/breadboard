/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err } from "@breadboard-ai/utils";
import z from "zod";
import { tr } from "../../a2/utils.js";
import {
  defineFunction,
  FunctionDefinition,
  mapDefinitions,
} from "../function-definition.js";
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
};

const instruction = tr`

## Using NotebookLM

You have access to NotebookLM notebooks as knowledge sources. When the objective
references a NotebookLM notebook (indicated by an nlm:/ reference), you can:

1. Use "${NOTEBOOKLM_RETRIEVE_CHUNKS_FUNCTION}" to retrieve relevant information 
   based on a query.

2. Use "${NOTEBOOKLM_GENERATE_ANSWER_FUNCTION}" to generate a comprehensive answer 
   to a question using the notebook's AI chat functionality. This is useful when 
   you need the notebook to synthesize information and provide a direct answer.

The nlm:/ reference format is "nlm:/{notebook_id}" where "{notebook_id}" is the 
ID you should pass to the function (without the "nlm:/" prefix).
`;

// Schema for a content piece (text, image, or audio)
const contentPieceSchema = z
  .object({
    text: z.string().optional().describe("Text content"),
    image: z
      .object({
        url: z.string().optional().describe("URL to the image"),
        data: z.string().optional().describe("Base64 encoded image data"),
        mime_type: z.string().optional().describe("MIME type of the image"),
      })
      .optional()
      .describe("Image reference"),
    audio: z
      .object({
        url: z.string().optional().describe("URL to the audio"),
        data: z.string().optional().describe("Base64 encoded audio data"),
        mime_type: z.string().optional().describe("MIME type of the audio"),
      })
      .optional()
      .describe("Audio reference"),
  })
  .describe("A piece of content (text, image, or audio)");

function getNotebookLMFunctionGroup(
  args: NotebookLMFunctionArgs
): FunctionGroup {
  return {
    ...mapDefinitions(defineNotebookLMFunctions(args)),
    instruction,
  };
}

/**
 * Converts a ContentPiece from the API response to a serializable format.
 */
function formatContentPiece(piece: ContentPiece): {
  text?: string;
  image?: { url?: string; data?: string; mime_type?: string };
  audio?: { url?: string; data?: string; mime_type?: string };
} {
  const result: {
    text?: string;
    image?: { url?: string; data?: string; mime_type?: string };
    audio?: { url?: string; data?: string; mime_type?: string };
  } = {};

  if (piece.text !== undefined) {
    result.text = piece.text;
  }

  if (piece.image) {
    result.image = {
      url: piece.image.url ?? piece.image.blobId,
      data: piece.image.data,
      mime_type: piece.image.mimeType,
    };
  }

  if (piece.audio) {
    result.audio = {
      url: piece.audio.url ?? piece.audio.blobId,
      data: piece.audio.data,
      mime_type: piece.audio.mimeType,
    };
  }

  return result;
}

function defineNotebookLMFunctions(
  args: NotebookLMFunctionArgs
): FunctionDefinition[] {
  const { notebookLmApiClient, taskTreeManager } = args;

  return [
    defineFunction(
      {
        name: NOTEBOOKLM_RETRIEVE_CHUNKS_FUNCTION,
        icon: "notebooklm",
        description: tr`Retrieves relevant source data from a NotebookLM notebook 
based on a query. Use this to query knowledge stored in NotebookLM notebooks.`,
        parameters: {
          notebook_id: z.string().describe(
            tr`The NotebookLM notebook ID. Extract this from the nlm:/ reference 
by removing the "nlm:/" prefix. For example, if the reference is 
"nlm:/abc123", pass "abc123" as the notebook_id.`
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
                content: z
                  .array(contentPieceSchema)
                  .describe(
                    "The content pieces from the chunk (may include text, images, or audio)"
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
              contextTokenBudget: 1000,
              provenance: {
                originProductType: OriginProductType.GOOGLE_NOTEBOOKLM_EVALS,
                clientInfo: {
                  applicationPlatform: ApplicationPlatform.WEB,
                  device: DeviceType.DESKTOP,
                },
              },
            });

          // Format the response for LLM consumption, including multimodal content
          const chunks = response.sourceContexts.flatMap(
            (sourceContext: SourceContext) =>
              sourceContext.chunks.map((chunk) => ({
                source_name: sourceContext.sourceName,
                source_display_name: sourceContext.source?.displayName,
                source_create_time: sourceContext.source?.createTime,
                content: chunk.content.pieces.map(formatContentPiece),
              }))
          );

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
        icon: "notebooklm",
        description: tr`Generates an answer to a question using a NotebookLM notebook's 
chat functionality. The notebook's AI will synthesize information from its sources 
to provide a comprehensive answer. Use this when you need a direct answer rather 
than raw chunks of content.`,
        parameters: {
          notebook_id: z.string().describe(
            tr`The NotebookLM notebook ID. Extract this from the nlm:/ reference 
by removing the "nlm:/" prefix. For example, if the reference is 
"nlm:/abc123", pass "abc123" as the notebook_id.`
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
