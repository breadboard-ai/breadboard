/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "@breadboard-ai/types";

export { SchemaDiffer };

const SIMPLE_PROPS: readonly (keyof Schema)[] = [
  "title",
  "description",
  "format",
  "transient",
  "default",
  "minItems",
];

const ARRAY_PROPS: readonly (keyof Schema)[] = ["behavior", "enum", "examples"];

export type SchemaDiff = {
  additionalPropsChanged: boolean;
  added: Set<string>;
  removed: Set<string>;
  updated: Set<string>;
};

class SchemaDiffer implements SchemaDiff {
  additionalPropsChanged: boolean;
  added: Set<string> = new Set();
  removed: Set<string> = new Set();
  updated: Set<string> = new Set();

  constructor(
    public readonly existing: Schema,
    public readonly incoming: Schema
  ) {
    this.additionalPropsChanged = this.computeAdditionPropsChanged();
  }

  computeDiff(): void {
    this.computePropertyChanges();
    this.computePropertyChanges();
  }

  same(): boolean {
    return (
      this.added.size === 0 &&
      this.removed.size === 0 &&
      this.updated.size === 0 &&
      this.additionalPropsChanged === false
    );
  }

  diff(): SchemaDiff {
    return {
      additionalPropsChanged: this.additionalPropsChanged,
      added: this.added,
      removed: this.removed,
      updated: this.updated,
    };
  }

  computeAdditionPropsChanged() {
    const incoming = !!this.incoming?.additionalProperties;
    const existing = !!this.existing?.additionalProperties;
    return incoming !== existing;
  }

  computeRequiredChanges() {
    const existing = this.existing?.required || [];
    const incoming = this.incoming?.required || [];

    const existingSet = new Set(existing);
    for (const name of incoming) {
      if (!existingSet.has(name)) this.updated.add(name);
    }
    const incomingSet = new Set(incoming);
    for (const name of existing) {
      if (!incomingSet.has(name)) this.updated.add(name);
    }
    return false;
  }

  computePropertyChanges() {
    const existing = this.existing?.properties || {};
    const incoming = this.incoming?.properties || {};
    const all = new Set([...Object.keys(existing), ...Object.keys(incoming)]);

    for (const name of all) {
      if (!(name in existing)) {
        this.added.add(name);
        continue;
      }
      if (!(name in incoming)) {
        this.removed.add(name);
        continue;
      }

      if (wasUpdated(existing[name], incoming[name])) {
        this.updated.add(name);
      }
    }

    function wasUpdated(existing: Schema, incoming: Schema): boolean {
      if (existing.type !== incoming.type) return true;

      if (SIMPLE_PROPS.some((prop) => existing[prop] !== incoming[prop])) {
        return true;
      }

      if (
        ARRAY_PROPS.some((prop) => {
          const existingArray = (existing[prop] || []) as string[];
          const incomingArray = (incoming[prop] || []) as string[];

          if (existingArray.length != incomingArray.length) return true;

          if (!existingArray.every((item) => incomingArray.includes(item))) {
            return true;
          }
          return false;
        })
      ) {
        return true;
      }

      if (existing.items || incoming.items) {
        if (!existing.items || !incoming.items) return true;

        if (wasUpdated(existing.items as Schema, incoming.items as Schema))
          return true;
      }

      if (existing.properties || incoming.properties) {
        if (!existing.properties || !incoming.properties) return true;

        const allPropNames = new Set([
          ...Object.keys(existing.properties),
          ...Object.keys(incoming.properties),
        ]);

        for (const name in allPropNames) {
          if (!(name in existing.properties)) return true;
          if (!(name in incoming.properties)) return true;

          if (
            wasUpdated(existing.properties[name], incoming.properties[name])
          ) {
            return true;
          }
        }
      }

      return false;
    }
  }
}
