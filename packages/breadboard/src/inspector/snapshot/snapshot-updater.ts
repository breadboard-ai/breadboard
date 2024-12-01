/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type SnapshotUpdaterArgs<Value> = {
  initial(): Value;
  latest(): Promise<Value>;
  willUpdate(previous: Value, current: Value): void;
};

type Snapshot<Value> = {
  current: Value;
  latest: Promise<Value>;
};

export { SnapshotUpdater };

class SnapshotUpdater<Value> {
  #current: Value | null = null;

  constructor(public readonly args: SnapshotUpdaterArgs<Value>) {}

  snapshot(): Snapshot<Value> {
    return {
      current: this.current(),
      latest: this.latest(),
    };
  }

  current(): Value {
    if (!this.#current) {
      this.#current = this.args.initial();
    }
    return this.#current;
  }

  async latest(): Promise<Value> {
    return this.args.latest().then((latest) => {
      this.args.willUpdate(this.current(), latest);
      this.#current = latest;
      return latest;
    });
  }
}
