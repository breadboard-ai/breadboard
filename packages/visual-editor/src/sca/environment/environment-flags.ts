/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "@lit-labs/signals";
import { RuntimeFlagManager, RuntimeFlags } from "@breadboard-ai/types";
import { field } from "../controller/decorators/field.js";
import { RootController } from "../controller/subcontrollers/root-controller.js";

export { EnvironmentFlags };

/**
 * A single, signal-backed store for feature flags with IDB-persisted
 * user overrides.
 *
 * Instead of one `@field` per flag (the old FlagController pattern),
 * EnvironmentFlags stores a **single `@field` for the overrides map**
 * and lazily creates one `Signal.Computed` per flag key. Each computed
 * merges the user-override (if any) with the deployment-provided default.
 *
 * ## Why RootController?
 * Extends RootController for its persistence infrastructure (`@field`,
 * `isHydrated`), not because this is a "Controller" in the SCA sense.
 * EnvironmentFlags lives in the **Environment** layer, beneath Controllers.
 * A future rename of `RootController` → `PersistableBase` would make
 * this clearer.
 *
 * ## Adding a New Flag
 * Only requires adding the key to `RuntimeFlags` in `packages/types` and
 * a default in `client-deployment-configuration.ts`. Zero boilerplate here.
 */
class EnvironmentFlags extends RootController implements RuntimeFlagManager {
  #env: RuntimeFlags;
  #computed = new Map<keyof RuntimeFlags, Signal.Computed<boolean>>();

  /**
   * A single persisted field: the user's flag overrides.
   * `@field` handles IDB persistence and hydration automatically.
   */
  @field({ persist: "idb" })
  accessor _overrides: Partial<RuntimeFlags> = {};

  constructor(
    env: RuntimeFlags,
    controllerId = "Environment_Flags",
    persistenceId = "EnvironmentFlags"
  ) {
    super(controllerId, persistenceId);
    this.#env = env;

    // Create one Computed signal per flag that merges env + overrides.
    for (const key of Object.keys(env) as Array<keyof RuntimeFlags>) {
      this.#computed.set(
        key,
        new Signal.Computed(() => this._overrides[key] ?? this.#env[key])
      );
    }
  }

  /** Read a flag (reactive — tracked by SignalWatcher). */
  get<K extends keyof RuntimeFlags>(key: K): boolean {
    const computed = this.#computed.get(key);
    if (!computed) {
      throw new Error(`Unknown flag: ${key}`);
    }
    return computed.get();
  }

  /** Override a flag (persists to IDB via @field, updates computed). */
  async override(key: keyof RuntimeFlags, value: boolean): Promise<void> {
    await this.isHydrated;
    this._overrides = { ...this._overrides, [key]: value };
  }

  /** Clear an override (reverts to env default). */
  async clearOverride(key: keyof RuntimeFlags): Promise<void> {
    await this.isHydrated;
    const next = { ...this._overrides };
    delete next[key];
    this._overrides = next;
  }

  /** Gets current flags as provided by the environment. */
  env(): Readonly<RuntimeFlags> {
    return this.#env;
  }

  /** Current values of runtime flags, combining env and overrides. */
  async flags(): Promise<Readonly<RuntimeFlags>> {
    await this.isHydrated;
    const result: Partial<RuntimeFlags> = {};
    for (const key of Object.keys(this.#env) as Array<keyof RuntimeFlags>) {
      result[key] = this.get(key);
    }
    return result as Readonly<RuntimeFlags>;
  }

  /** Gets only the flags that have been explicitly overridden by the user. */
  async overrides(): Promise<Partial<Readonly<RuntimeFlags>>> {
    await this.isHydrated;
    const result: Partial<RuntimeFlags> = {};
    for (const key of Object.keys(this.#env) as Array<keyof RuntimeFlags>) {
      const override = this._overrides[key];
      if (override !== undefined && override !== this.#env[key]) {
        result[key] = override;
      }
    }
    return result;
  }

  /** Reset all overrides, reverting every flag to env defaults. */
  resetAll(): void {
    this._overrides = {};
  }
}
