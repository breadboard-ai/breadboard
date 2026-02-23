/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeFlagManager, RuntimeFlags } from "@breadboard-ai/types";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";
import type { EnvironmentFlags } from "../../../environment/environment-flags.js";

export { FlagController };

/**
 * Thin compatibility delegate over `EnvironmentFlags`.
 *
 * All flag storage, reactivity, and IDB persistence live in
 * `EnvironmentFlags`. This class exists only as a bridge while
 * consumers migrate from `controller.global.flags.agentMode` to
 * `env.flags.get("agentMode")`.
 *
 * Individual property getters delegate to `envFlags.get()`.
 * `override()`, `clearOverride()`, etc. delegate directly.
 *
 * **Migration fields** (`_migrated`, `_flagsV1Reset`) remain here
 * because they are part of the controller migration system, not
 * flag storage.
 */
class FlagController
  extends RootController
  implements RuntimeFlagManager, RuntimeFlags
{
  #envFlags: EnvironmentFlags;

  constructor(
    controllerId: string,
    persistenceId: string,
    envFlags: EnvironmentFlags
  ) {
    super(controllerId, persistenceId);
    this.#envFlags = envFlags;
  }

  // ── Flag getters (delegate to EnvironmentFlags.get()) ─────────
  get agentMode() {
    return this.#envFlags.get("agentMode");
  }
  get consistentUI() {
    return this.#envFlags.get("consistentUI");
  }
  get enableDrivePickerInLiteMode() {
    return this.#envFlags.get("enableDrivePickerInLiteMode");
  }
  get enableGoogleDriveTools() {
    return this.#envFlags.get("enableGoogleDriveTools");
  }
  get enableResumeAgentRun() {
    return this.#envFlags.get("enableResumeAgentRun");
  }
  get force2DGraph() {
    return this.#envFlags.get("force2DGraph");
  }
  get googleOne() {
    return this.#envFlags.get("googleOne");
  }
  get mcp() {
    return this.#envFlags.get("mcp");
  }
  get opalAdk() {
    return this.#envFlags.get("opalAdk");
  }
  get outputTemplates() {
    return this.#envFlags.get("outputTemplates");
  }
  get requireConsentForGetWebpage() {
    return this.#envFlags.get("requireConsentForGetWebpage");
  }
  get requireConsentForOpenWebpage() {
    return this.#envFlags.get("requireConsentForOpenWebpage");
  }
  get streamGenWebpage() {
    return this.#envFlags.get("streamGenWebpage");
  }
  get streamPlanner() {
    return this.#envFlags.get("streamPlanner");
  }
  get enableNotebookLm() {
    return this.#envFlags.get("enableNotebookLm");
  }
  get enableGraphEditorAgent() {
    return this.#envFlags.get("enableGraphEditorAgent");
  }
  get textEditorRemix() {
    return this.#envFlags.get("textEditorRemix");
  }

  // ── Migration fields (controller-scoped, not flag storage) ────

  @field({ persist: "local" })
  private accessor _migrated = false;

  /**
   * Used by `flagsMigration` in migrations.ts to migrate from IdbFlagManager.
   * @deprecated
   */
  get isMigrated() {
    return this._migrated;
  }

  /**
   * Used by `flagsMigration` in migrations.ts to migrate from IdbFlagManager.
   * @deprecated
   */
  async migrate(flags: RuntimeFlags) {
    const entries = Object.entries(flags) as [keyof RuntimeFlags, boolean][];
    for (const [flag, value] of entries) {
      await this.#envFlags.override(flag, value);
    }
    this._migrated = true;
  }

  /**
   * Tracks whether the V1 "sticky env" fix has been applied.
   */
  @field({ persist: "local" })
  private accessor _flagsV1Reset = false;

  get isFlagsV1Reset() {
    return this._flagsV1Reset;
  }

  /**
   * Clears all stored flag overrides to fix the "sticky env" bug.
   * Called by `flagsV1ResetMigration` in migrations.ts.
   */
  resetAllFlags() {
    this.#envFlags.resetAll();
    this._flagsV1Reset = true;
  }

  // ── RuntimeFlagManager interface (delegate) ───────────────────

  env(): Readonly<RuntimeFlags> {
    return this.#envFlags.env();
  }

  async flags(): Promise<Readonly<RuntimeFlags>> {
    return this.#envFlags.flags();
  }

  async override(flag: keyof RuntimeFlags, value: boolean): Promise<void> {
    return this.#envFlags.override(flag, value);
  }

  async overrides(): Promise<Partial<Readonly<RuntimeFlags>>> {
    return this.#envFlags.overrides();
  }

  async clearOverride(flag: keyof RuntimeFlags): Promise<void> {
    return this.#envFlags.clearOverride(flag);
  }
}
