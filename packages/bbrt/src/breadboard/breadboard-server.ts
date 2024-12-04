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

export class BreadboardServer {
  readonly #baseUrl: string;

  constructor(url: string) {
    this.#baseUrl = url;
  }

  get url() {
    return this.#baseUrl;
  }

  async boards(): Promise<Result<BreadboardBoardListing[]>> {
    const url = new URL("/boards", this.#baseUrl);
    const response = await resultify(fetch(url));
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

  async board(boardPath: string): Promise<Result<GraphDescriptor>> {
    const url = new URL(`/boards/${boardPath}`, this.#baseUrl);
    const response = await resultify(fetch(url));
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
