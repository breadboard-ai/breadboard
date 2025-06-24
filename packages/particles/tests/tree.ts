/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { ParticleTree } from "../src/tree.js";
import { toParticle } from "../src/utils.js";
import { deepStrictEqual, equal, throws } from "node:assert";
import { GroupParticle } from "../src/types.js";

describe("ParticleTree", () => {
  it("Applies upsert operations", () => {
    const tree = new ParticleTree({
      create(particle) {
        return toParticle(particle);
      },
    });

    tree.apply({
      jsonrpc: "2.0",
      method: "suip/ops/upsert",
      params: { path: [], id: "a", particle: { text: "foo" } },
    });

    equal(tree.root.group.size, 1);
    deepStrictEqual(tree.root.group.get("a"), { text: "foo" });
    deepStrictEqual([...tree.root.group.keys()], ["a"]);

    throws(() => {
      tree.apply({
        jsonrpc: "2.0",
        method: "suip/ops/upsert",
        params: { path: ["a"], id: "b", particle: { text: "bar " } },
      });
    });
    deepStrictEqual([...tree.root.group.keys()], ["a"]);

    tree.apply({
      jsonrpc: "2.0",
      method: "suip/ops/upsert",
      params: { path: [], id: "b", particle: { text: "bar" } },
    });

    equal(tree.root.group.size, 2);
    deepStrictEqual(tree.root.group.get("b"), { text: "bar" });
    deepStrictEqual([...tree.root.group.keys()], ["a", "b"]);

    tree.apply({
      jsonrpc: "2.0",
      method: "suip/ops/upsert",
      params: { path: ["c"], id: "d", particle: { text: "baz" } },
    });
    equal(tree.root.group.size, 3);
    deepStrictEqual([...tree.root.group.keys()], ["a", "b", "c"]);
    deepStrictEqual(
      (tree.root.group.get("c") as GroupParticle).group.get("d"),
      { text: "baz" }
    );

    tree.apply({
      jsonrpc: "2.0",
      method: "suip/ops/upsert",
      params: { path: [], id: "a", particle: { text: "baz" } },
    });
    equal(tree.root.group.size, 3);
    deepStrictEqual([...tree.root.group.keys()], ["a", "b", "c"]);
    deepStrictEqual(tree.root.group.get("a"), { text: "baz" });

    tree.apply({
      jsonrpc: "2.0",
      method: "suip/ops/upsert",
      params: { path: [], id: "f", particle: { text: "qux" }, before: "a" },
    });
    equal(tree.root.group.size, 4);
    deepStrictEqual([...tree.root.group.keys()], ["f", "a", "b", "c"]);

    tree.apply({
      jsonrpc: "2.0",
      method: "suip/ops/upsert",
      params: { path: [], id: "a", particle: { text: "zub" }, before: "f" },
    });
    equal(tree.root.group.size, 4);
    deepStrictEqual([...tree.root.group.keys()], ["a", "f", "b", "c"]);
    deepStrictEqual(tree.root.group.get("a"), { text: "zub" });
  });
});
