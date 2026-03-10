/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { assembleFunctionGroup } from "../function-definition.js";
import { AgentFileSystem } from "../file-system.js";
import { FunctionGroup } from "../types.js";
import { TaskTreeManager } from "../task-tree-manager.js";
import {
  ContentPiece,
  NotebookLmApiClient,
  ResponseContentType,
  RetrieveRelevantChunksResponse,
  SourceContext,
  ImageReference,
  AudioReference,
} from "../../../sca/services/notebooklm-api-client.js";

import {
  declarations,
  metadata,
  instruction,
  type NotebooklmRetrieveRelevantChunksParams,
  type NotebooklmGenerateAnswerParams,
} from "./generated/notebooklm.js";

export { getNotebookLMFunctionGroup };

export type NotebookLMFunctionArgs = {
  notebookLmApiClient: NotebookLmApiClient;
  taskTreeManager: TaskTreeManager;
  fileSystem: AgentFileSystem;
};

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

    const addMediaRef = (
      ref: ImageReference | AudioReference | undefined,
      defaultMimeType: string
    ): void => {
      if (!ref) return;
      const mimeType = ref.mimeType ?? defaultMimeType;
      if (ref.blobId) {
        const handle = new URL(
          `/board/blobs/${ref.blobId}`,
          window.location.href
        ).href;
        addToFileSystem({ storedData: { handle, mimeType } });
      } else if (ref.url) {
        addToFileSystem({ fileData: { fileUri: ref.url, mimeType } });
      } else if (ref.data) {
        addToFileSystem({ inlineData: { data: ref.data, mimeType } });
      }
    };

    addMediaRef(piece.image, "image/png");
    addMediaRef(piece.audio, "audio/mpeg");
  }

  return { textContent, mediaPaths, errors };
}

function getNotebookLMFunctionGroup(
  args: NotebookLMFunctionArgs
): FunctionGroup {
  const { notebookLmApiClient, taskTreeManager, fileSystem } = args;

  return assembleFunctionGroup(declarations, metadata, instruction, {
    notebooklm_retrieve_relevant_chunks: async ({
      notebook_id,
      query,
      task_id,
      status_update,
    }: NotebooklmRetrieveRelevantChunksParams) => {
      taskTreeManager.setInProgress(task_id, status_update);

      try {
        const response: RetrieveRelevantChunksResponse =
          await notebookLmApiClient.retrieveRelevantChunks({
            name: `notebooks/${notebook_id}`,
            query,
            // TODO: decide what to do about budget
            contextTokenBudget: 1000000,
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
    },

    notebooklm_generate_answer: async ({
      notebook_id,
      query,
      task_id,
      status_update,
    }: NotebooklmGenerateAnswerParams) => {
      taskTreeManager.setInProgress(task_id, status_update);

      try {
        const sessionId = "defaultChatSession";
        const response = await notebookLmApiClient.generateAnswer({
          name: `notebooks/${notebook_id}/chatSessions/${sessionId}`,
          query,
          responseContentType: ResponseContentType.MARKDOWN,
        });

        return { answer: response.markdownContent || "" };
      } catch (error) {
        return err(
          `Failed to generate answer from notebook: ${(error as Error).message}`
        );
      }
    },
  });
}
