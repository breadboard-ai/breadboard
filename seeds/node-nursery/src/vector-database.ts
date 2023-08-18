/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { similarity } from "ml-distance";
import { Capability } from "@google-labs/graph-runner";

/**
 * Entry into a vector database.
 * Client can add as many other fields as they like.
 *
 * The only required field is @field embedding, which is a vector of numbers.
 *
 * Some databases, e.g. Pinecone, will also required a @field id field.
 */
export interface VectorDocument extends Capability {
  embedding: number[];
  id?: string | number | symbol;
}

export interface VectorQueryResult extends Capability {
  document: VectorDocument;
  similarity: number;
}

export interface VectorDatabase extends Capability {
  add(documents: VectorDocument[]): Promise<void>;
  remove(ids: VectorDocument["id"][]): Promise<void>;
  findNearest(
    embedding: VectorDocument["embedding"],
    topK?: number
  ): Promise<VectorQueryResult[]>;
}

export class MemoryVectorDatabase implements VectorDatabase {
  readonly kind = "VectorDatabase";
  private entries: Map<VectorDocument["id"], VectorDocument> = new Map();
  private similarity: (typeof similarity)["cosine"];

  /**
   * Creates a new in-memory vector database.
   *
   * @param similarityFunction The name of the similarity function to use.
   *                           Defaults to cosine.
   */
  constructor(similarityFunction = "cosine") {
    if (similarityFunction in similarity) {
      this.similarity =
        similarity[similarityFunction as keyof typeof similarity];
    } else {
      throw Error("Can't find similarity function: " + similarityFunction);
    }
  }

  /**
   * Adds documents to the database.
   * If a document with the same id already exists, it will be overwritten.
   *
   * @param documents Documents to be added to the database.
   */
  async add(documents: VectorDocument[]): Promise<void> {
    for (const document of documents) {
      if (!document.embedding) throw Error("Document has no embedding");

      // Symbol() gives us non-colliding default ids where none are provided.
      this.entries.set(document.id ?? Symbol(), document);
    }
    return Promise.resolve();
  }

  /**
   * Removes documents from the database.
   *
   * @param ids List of ids to be removed from the database.
   */
  async remove(ids: VectorDocument["id"][]): Promise<void> {
    for (const id of ids) {
      this.entries.delete(id);
    }
    return Promise.resolve();
  }

  /**
   * Finds the nearest neighbors to a given embedding.
   *
   * @param embedding Embedding to find nearest neighbors for.
   * @param topK Number of documents to return. Defaults to 10.
   * @returns Array of the topK nearest neighbors.
   */
  async findNearest(
    embedding: VectorDocument["embedding"],
    topK = 10
  ): Promise<VectorQueryResult[]> {
    return Array.from(this.entries.values())
      .map(
        (document) =>
          ({
            document,
            similarity: this.similarity(document.embedding, embedding),
          } as VectorQueryResult)
      )
      .sort((a, b) => b.similarity - a.similarity)
      .splice(0, topK);
  }
}
