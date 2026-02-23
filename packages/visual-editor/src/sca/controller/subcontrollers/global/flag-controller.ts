/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";
import type { RuntimeFlags } from "@breadboard-ai/types";
import type { EnvironmentFlags } from "../../../environment/environment-flags.js";

export { FlagController };

/**
 * Migration-only persistence shell for flag-related IDB fields.
 *
 * All runtime flag access has moved to `EnvironmentFlags`
 * (accessed via `env.flags`). This class exists solely to anchor
 * the two one-time migration markers (`_migrated`, `_flagsV1Reset`)
 * whose values persist in IndexedDB under this controller's
 * persistence ID.
 *
 * Once all users have passed through both migrations, this class
 * and the migration code in `migrations.ts` can be deleted entirely.
 */
class FlagController extends RootController {
  #envFlags: EnvironmentFlags;

  constructor(
    controllerId: string,
    persistenceId: string,
    envFlags: EnvironmentFlags
  ) {
    super(controllerId, persistenceId);
    this.#envFlags = envFlags;
  }

  // ── Migration fields (IDB-persisted, controller-scoped) ───────

  @field({ persist: "local" })
  private accessor _migrated = false;

  /**
   * Used by `flagsMigration` in migrations.ts to migrate from IdbFlagManager.
   * @deprecated Remove once all users have migrated.
   */
  get isMigrated() {
    return this._migrated;
  }

  /**
   * Used by `flagsMigration` in migrations.ts to migrate from IdbFlagManager.
   * @deprecated Remove once all users have migrated.
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
   * @deprecated Remove once all users have migrated.
   */
  resetAllFlags() {
    this.#envFlags.resetAll();
    this._flagsV1Reset = true;
  }
}
