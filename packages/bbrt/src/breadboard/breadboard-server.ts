/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  NodeDescriberResult,
} from "@google-labs/breadboard";
import { getDefaultSchema } from "./get-default-schema.js";

export class BreadboardServer {
  readonly #baseUrl: string;

  constructor(url: string) {
    this.#baseUrl = url;
  }

  get url() {
    return this.#baseUrl;
  }

  async boards(): Promise<BreadboardBoardListing[]> {
    const url = new URL("/boards", this.#baseUrl);
    // TODO(aomarks) Better error handling.
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}: ${response.statusText}`);
    }
    return (await response.json()) as BreadboardBoardListing[];
  }

  async board(boardPath: string): Promise<GraphDescriptor> {
    const url = new URL(`/boards/${boardPath}`, this.#baseUrl);
    // TODO(aomarks) Better error handling.
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}: ${response.statusText}`);
    }
    return (await response.json()) as GraphDescriptor;
  }

  async boardsDetailed(): Promise<BreadboardBoardListingDetailed[]> {
    const listings = await this.boards();
    const details: BreadboardBoardListingDetailed[] = [];
    await Promise.all(
      listings.map(async (listing) => {
        const bgl = await this.board(listing.path);
        const schema = await getDefaultSchema(bgl);
        if (!schema.ok) {
          console.error(
            "Error getting schema for board",
            listing.path,
            schema.error
          );
          return;
        }
        if (!bgl.title || !bgl.description) {
          return;
        }
        details.push({
          ...listing,
          bgl,
          schema: schema.value,
        });
      })
    );
    return details;
  }
}

export interface BreadboardBoardListing {
  title: string;
  path: string;
  username: string;
  readonly: boolean;
  mine: boolean;
  tags: string[];
}

export interface BreadboardBoardListingDetailed extends BreadboardBoardListing {
  bgl: GraphDescriptor;
  schema: NodeDescriberResult;
}
