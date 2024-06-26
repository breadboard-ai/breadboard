/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BasicChunker } from "@google-labs/chunker";
import { InputValues, NodeValue } from "@google-labs/breadboard";

export type ChunkerInputs = InputValues & {
  /**
   * The data to chunk.
   */
  data: NodeValue;
  /**
   * The maximum number of words per passage.
   */
  maxWordsPerPassage: number;
  /**
   * Whether to greedily aggregate siblings.
   */
  greedilyAggregateSiblings: boolean;
};

export type ChunkerOutputs = InputValues & {
  /**
   * The chunked data.
   */
  chunks: string[];
};

export default async (inputs: InputValues): Promise<ChunkerOutputs> => {
  const { data, maxWordsPerPassage, greedilyAggregateSiblings } =
    inputs as ChunkerInputs;

  const chunker = new BasicChunker({
    maxWordsPerPassage,
    greedilyAggregateSiblings,
  });

  const chunks = chunker.chunk(data);
  return {
    chunks,
  };
};
