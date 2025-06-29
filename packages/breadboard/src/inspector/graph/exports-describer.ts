/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriberFactory,
  MutableGraph,
  NodeDescriberExport,
  NodeDescriberResult,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";

export { ExportsDescriber };

class ExportsDescriber {
  constructor(
    private readonly mutable: MutableGraph,
    private readonly describerFactory: GraphDescriberFactory
  ) {}

  async transform(result: NodeDescriberResult): Promise<NodeDescriberResult> {
    const { exports } = this.mutable.graph;
    if (!exports) return result;

    const entries = Object.fromEntries(
      (
        await Promise.all(
          exports.map(async (id) => {
            const describer = this.describerFactory(id, this.mutable);
            if (!ok(describer)) return null;

            const result = await describer.describe();
            const url = `${this.mutable.graph.url}${id}`;
            return [url, result];
          })
        )
      ).filter((item) => item !== null) as [string, NodeDescriberExport][]
    );

    return { ...result, exports: entries };
  }
}
