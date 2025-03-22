/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "../../data/file-system/utils.js";
import { NodeDescriberExport, NodeDescriberResult } from "../../types.js";
import { GraphDescriberFactory, MutableGraph } from "../types.js";

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
            return [id, result];
          })
        )
      ).filter((item) => item !== null) as [string, NodeDescriberExport][]
    );

    return { ...result, exports: entries };
  }
}
