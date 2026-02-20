/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeFlagManager, RuntimeFlags } from "@breadboard-ai/types";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

function valueOrThrow(
  flag: keyof RuntimeFlags,
  value: boolean | null | undefined
): boolean {
  if (value === null || value === undefined)
    throw new Error(`${flag} was not set by environment`);
  return value;
}

export class FlagController
  extends RootController
  implements RuntimeFlagManager, RuntimeFlags
{
  @field({ persist: "idb" })
  private accessor _agentMode: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _consistentUI: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _enableDrivePickerInLiteMode: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _enableGoogleDriveTools: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _enableResumeAgentRun: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _force2DGraph: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _googleOne: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _mcp: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _opalAdk: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _outputTemplates: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _requireConsentForGetWebpage: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _requireConsentForOpenWebpage: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _streamGenWebpage: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _streamPlanner: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _enableNotebookLm: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _enableGraphEditorAgent: boolean | null = null;

  get agentMode() {
    return valueOrThrow("agentMode", this._agentMode ?? this.#env.agentMode);
  }
  get consistentUI() {
    return valueOrThrow(
      "consistentUI",
      this._consistentUI ?? this.#env.consistentUI
    );
  }
  get enableDrivePickerInLiteMode() {
    return valueOrThrow(
      "enableDrivePickerInLiteMode",
      this._enableDrivePickerInLiteMode ?? this.#env.enableDrivePickerInLiteMode
    );
  }
  get enableGoogleDriveTools() {
    return valueOrThrow(
      "enableGoogleDriveTools",
      this._enableGoogleDriveTools ?? this.#env.enableGoogleDriveTools
    );
  }
  get enableResumeAgentRun() {
    return valueOrThrow(
      "enableResumeAgentRun",
      this._enableResumeAgentRun ?? this.#env.enableResumeAgentRun
    );
  }
  get force2DGraph() {
    return valueOrThrow(
      "force2DGraph",
      this._force2DGraph ?? this.#env.force2DGraph
    );
  }
  get googleOne() {
    return valueOrThrow("googleOne", this._googleOne ?? this.#env.googleOne);
  }
  get mcp() {
    return valueOrThrow("mcp", this._mcp ?? this.#env.mcp);
  }
  get opalAdk() {
    return valueOrThrow("opalAdk", this._opalAdk ?? this.#env.opalAdk);
  }
  get outputTemplates() {
    return valueOrThrow(
      "outputTemplates",
      this._outputTemplates ?? this.#env.outputTemplates
    );
  }
  get requireConsentForGetWebpage() {
    return valueOrThrow(
      "requireConsentForGetWebpage",
      this._requireConsentForGetWebpage ?? this.#env.requireConsentForGetWebpage
    );
  }
  get requireConsentForOpenWebpage() {
    return valueOrThrow(
      "requireConsentForOpenWebpage",
      this._requireConsentForOpenWebpage ??
        this.#env.requireConsentForOpenWebpage
    );
  }
  get streamGenWebpage() {
    return valueOrThrow(
      "streamGenWebpage",
      this._streamGenWebpage ?? this.#env.streamGenWebpage
    );
  }
  get streamPlanner() {
    return valueOrThrow(
      "streamPlanner",
      this._streamPlanner ?? this.#env.streamPlanner
    );
  }
  get enableNotebookLm() {
    return valueOrThrow(
      "enableNotebookLm",
      this._enableNotebookLm ?? this.#env.enableNotebookLm
    );
  }
  get enableGraphEditorAgent() {
    return valueOrThrow(
      "enableGraphEditorAgent",
      this._enableGraphEditorAgent ?? this.#env.enableGraphEditorAgent
    );
  }

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
  migrate(flags: RuntimeFlags) {
    const entries = Object.entries(flags) as [keyof RuntimeFlags, boolean][];
    for (const [flag, value] of entries) {
      this.#set(flag, value);
    }

    this._migrated = true;
  }

  /**
   * Tracks whether the V1 "sticky env" fix has been applied.
   *
   * ## Background
   * Commit 2e7b70ab1 introduced a bug where the constructor eagerly populated
   * null values with env defaults after hydration, persisting them to IndexedDB.
   * On subsequent boots, the stored value took precedence—even though the user
   * never explicitly chose it. See `flagsV1ResetMigration` for full details.
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
    for (const flag of Object.keys(this.#env) as Array<keyof RuntimeFlags>) {
      this.#set(flag, null);
    }
    this._flagsV1Reset = true;
  }

  #set(flag: keyof RuntimeFlags, value: boolean | null) {
    switch (flag) {
      case "agentMode":
        this._agentMode = value;
        return;
      case "consistentUI":
        this._consistentUI = value;
        return;
      case "enableDrivePickerInLiteMode":
        this._enableDrivePickerInLiteMode = value;
        return;
      case "force2DGraph":
        this._force2DGraph = value;
        return;
      case "googleOne":
        this._googleOne = value;
        return;
      case "mcp":
        this._mcp = value;
        return;
      case "opalAdk":
        this._opalAdk = value;
        return;
      case "outputTemplates":
        this._outputTemplates = value;
        return;
      case "requireConsentForGetWebpage":
        this._requireConsentForGetWebpage = value;
        return;
      case "requireConsentForOpenWebpage":
        this._requireConsentForOpenWebpage = value;
        return;
      case "streamGenWebpage":
        this._streamGenWebpage = value;
        return;
      case "streamPlanner":
        this._streamPlanner = value;
        return;
      case "enableGoogleDriveTools":
        this._enableGoogleDriveTools = value;
        return;
      case "enableResumeAgentRun":
        this._enableResumeAgentRun = value;
        return;
      case "enableNotebookLm":
        this._enableNotebookLm = value;
        return;
      case "enableGraphEditorAgent":
        this._enableGraphEditorAgent = value;
        return;
    }
  }

  #env: RuntimeFlags;
  constructor(controllerId: string, persistenceId: string, env: RuntimeFlags) {
    super(controllerId, persistenceId);
    this.#env = env;
  }

  env(): Readonly<RuntimeFlags> {
    return this.#env;
  }

  async flags() {
    const entries: Partial<RuntimeFlags> = {};
    const envValues = Object.entries(this.#env) as [
      keyof RuntimeFlags,
      boolean,
    ][];
    for (const [flag, value] of envValues) {
      if (this[flag] !== null) entries[flag] = this[flag];
      else entries[flag] = value;
    }
    return entries as Readonly<RuntimeFlags>;
  }

  async override(flag: keyof RuntimeFlags, value: boolean): Promise<void> {
    this.#set(flag, value);
  }

  async overrides(): Promise<Partial<Readonly<RuntimeFlags>>> {
    const overrides: Partial<RuntimeFlags> = {};
    const envValues = Object.keys(this.#env) as Array<keyof RuntimeFlags>;
    for (const flag of envValues) {
      if (this[flag] === this.#env[flag] || this[flag] === null) {
        continue;
      }

      overrides[flag] = this[flag];
    }
    return overrides;
  }

  async clearOverride(flag: keyof RuntimeFlags): Promise<void> {
    this.#set(flag, null);
  }
}
