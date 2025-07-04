/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { type SchemaDiff, SchemaDiffer } from "../../src/schema-differ.js";
import { deepStrictEqual } from "node:assert";

function diff(schemaDiff: SchemaDiff): SchemaDiff {
  return schemaDiff;
}

describe("SchemaDiffer", () => {
  it("correctly diffs required properties", () => {
    {
      const differ = new SchemaDiffer({}, {});
      differ.computeRequiredChanges();
      deepStrictEqual(
        differ.diff(),
        diff({
          added: new Set(),
          removed: new Set(),
          updated: new Set(),
          additionalPropsChanged: false,
        })
      );
    }
    {
      const differ = new SchemaDiffer(
        {
          required: ["foo"],
        },
        {}
      );
      differ.computeRequiredChanges();
      deepStrictEqual(
        differ.diff(),
        diff({
          added: new Set(),
          removed: new Set(),
          updated: new Set(["foo"]),
          additionalPropsChanged: false,
        })
      );
    }
    {
      const differ = new SchemaDiffer(
        {},
        {
          required: ["foo"],
        }
      );
      differ.computeRequiredChanges();
      deepStrictEqual(
        differ.diff(),
        diff({
          added: new Set(),
          removed: new Set(),
          updated: new Set(["foo"]),
          additionalPropsChanged: false,
        })
      );
    }
    {
      const differ = new SchemaDiffer(
        {
          required: ["bar"],
        },
        {
          required: ["foo"],
        }
      );
      differ.computeRequiredChanges();
      deepStrictEqual(
        differ.diff(),
        diff({
          added: new Set(),
          removed: new Set(),
          updated: new Set(["foo", "bar"]),
          additionalPropsChanged: false,
        })
      );
    }
  });

  it("computes property changes", () => {
    {
      const differ = new SchemaDiffer(
        {
          properties: {
            foo: { type: "string" },
          },
        },
        {
          properties: {},
        }
      );
      differ.computePropertyChanges();
      deepStrictEqual(
        differ.diff(),
        diff({
          added: new Set(),
          removed: new Set(["foo"]),
          updated: new Set(),
          additionalPropsChanged: false,
        })
      );
    }
    {
      const differ = new SchemaDiffer(
        {
          properties: {},
        },
        {
          properties: {
            foo: { type: "string" },
          },
        }
      );
      differ.computePropertyChanges();
      deepStrictEqual(
        differ.diff(),
        diff({
          added: new Set(["foo"]),
          removed: new Set(),
          updated: new Set(),
          additionalPropsChanged: false,
        })
      );
    }
    {
      const differ = new SchemaDiffer(
        {
          properties: {
            foo: { type: "string" },
          },
        },
        {
          properties: {
            foo: { type: "number" },
          },
        }
      );
      differ.computePropertyChanges();
      deepStrictEqual(
        differ.diff(),
        diff({
          added: new Set(),
          removed: new Set(),
          updated: new Set(["foo"]),
          additionalPropsChanged: false,
        })
      );
    }
    {
      const differ = new SchemaDiffer(
        {
          properties: {
            foo: { type: "string" },
            baz: { type: "object", behavior: ["llm-content"] },
            qux: { type: "string" },
            zul: { type: "array" },
          },
        },
        {
          properties: {
            foo: { type: "string" },
            bar: { type: "number" },
            baz: { type: "object", behavior: ["llm-content", "config"] },
            qux: { type: "string" },
          },
        }
      );
      differ.computePropertyChanges();
      deepStrictEqual(
        differ.diff(),
        diff({
          added: new Set(["bar"]),
          removed: new Set(["zul"]),
          updated: new Set(["baz"]),
          additionalPropsChanged: false,
        })
      );
    }
    {
      const differ = new SchemaDiffer(
        {
          properties: {
            foo: {
              type: "array",
              items: { type: "object", behavior: ["llm-content"] },
            },
          },
        },
        {
          properties: {
            foo: {
              type: "array",
              items: { type: "object", behavior: ["llm-content", "config"] },
            },
          },
        }
      );
      differ.computePropertyChanges();
      deepStrictEqual(
        differ.diff(),
        diff({
          added: new Set(),
          removed: new Set(),
          updated: new Set(["foo"]),
          additionalPropsChanged: false,
        })
      );
    }
  });
});
