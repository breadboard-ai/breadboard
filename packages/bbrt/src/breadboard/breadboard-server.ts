/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@google-labs/breadboard";

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
}

export interface BreadboardBoardListing {
  title: string;
  path: string;
  username: string;
  readonly: boolean;
  mine: boolean;
  tags: string[];
}
