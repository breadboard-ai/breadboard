/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { ParticleTree } from "../src/tree.js";
import { toParticle } from "../src/utils.js";
import { deepStrictEqual, equal, throws } from "node:assert";

describe("ParticleTree", () => {
  it("Applies append operations", () => {
    const tree = new ParticleTree({
      create(particle) {
        return toParticle(particle);
      },
    });

    tree.apply({
      jsonrpc: "2.0",
      method: "suip/ops/append",
      params: { path: ["a"], particle: { text: "foo" } },
    });

    equal(tree.tree.group.size, 1);
    deepStrictEqual(tree.tree.group.get("a"), { text: "foo" });

    throws(() => {
      tree.apply({
        jsonrpc: "2.0",
        method: "suip/ops/append",
        params: { path: ["a", "b"], particle: { text: "bar " } },
      });
    });

    tree.apply({
      jsonrpc: "2.0",
      method: "suip/ops/append",
      params: { path: ["b"], particle: { text: "bar" } },
    });

    equal(tree.tree.group.size, 2);
    deepStrictEqual(tree.tree.group.get("b"), { text: "bar" });

    tree.apply({
      jsonrpc: "2.0",
      method: "suip/ops/append",
      params: { path: ["c", "d"], particle: { text: "baz" } },
    });
    equal(tree.tree.group.size, 3);
  });
});
