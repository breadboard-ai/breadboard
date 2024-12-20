/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  NodeDescriberResult,
} from "@google-labs/breadboard";
import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";
import { transposeResults } from "../util/transpose-results.js";
import { getDefaultSchema } from "./get-default-schema.js";

const BOARDS_CACHE_KEY = "bbrt-boards-v1";

export class BreadboardServiceClient {
  readonly #baseUrl: string;
  readonly #apiKey: string | undefined;

  constructor(url: string, apiKey?: string) {
    this.#baseUrl = url;
    this.#apiKey = apiKey;
  }

  get url() {
    return this.#baseUrl;
  }

  async boards(): Promise<Result<BreadboardBoardListing[]>> {
    // TODO(aomarks) This session-local caching is just a hack to make
    // development faster so that we don't have to fetch the board list on every
    // reload (though might not be a bad idea, with some refinement).
    const cached = sessionStorage.getItem(BOARDS_CACHE_KEY);
    if (cached) {
      return resultify(() => JSON.parse(cached) as BreadboardBoardListing[]);
    }
    const url = new URL("/boards", this.#baseUrl);
    const response = await resultify(fetch(url, { credentials: "include" }));
    if (!response.ok) {
      return response;
    }
    if (!response.value.ok) {
      return {
        ok: false,
        error: new Error(
          `HTTP ${response.value.status} ${response.value.statusText}`
        ),
      };
    }
    const parsed = await resultify(response.value.json());
    if (!parsed.ok) {
      return parsed;
    }
    sessionStorage.setItem(BOARDS_CACHE_KEY, JSON.stringify(parsed.value));
    return parsed;
  }

  async board(boardPath: string): Promise<Result<GraphDescriptor>> {
    const url = new URL(`/boards/${boardPath}`, this.#baseUrl);
    if (this.#apiKey) {
      url.searchParams.set("API_KEY", this.#apiKey);
    }
    const response = await resultify(fetch(url, { credentials: "include" }));
    if (!response.ok) {
      return response;
    }
    if (!response.value.ok) {
      return {
        ok: false,
        error: new Error(
          `HTTP ${response.value.status} ${response.value.statusText}`
        ),
      };
    }
    return resultify(response.value.json());
  }

  async boardsDetailed(): Promise<Result<BreadboardBoardListingDetailed[]>> {
    const listings = await this.boards();
    if (!listings.ok) {
      return listings;
    }
    return transposeResults(
      await Promise.all(
        listings.value.map(
          async (listing): Promise<Result<BreadboardBoardListingDetailed>> => {
            const bgl = await this.board(listing.path);
            if (!bgl.ok) {
              return bgl;
            }
            const schema = await getDefaultSchema(bgl.value);
            if (!schema.ok) {
              return schema;
            }
            return {
              ok: true,
              value: {
                ...listing,
                bgl: bgl.value,
                schema: schema.value,
              },
            };
          }
        )
      )
    );
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
