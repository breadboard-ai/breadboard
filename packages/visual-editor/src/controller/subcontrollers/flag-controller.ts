/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeFlagManager, RuntimeFlags } from "@breadboard-ai/types";
import { field } from "../decorators/field.js";
import { RootController } from "./root-controller.js";

export class FlagController
  extends RootController
  implements RuntimeFlagManager
{
  @field({ persist: "idb" })
  private accessor _agentMode: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _consistentUI: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _enableDrivePickerInLiteMode: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _force2DGraph: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _generateForEach: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _googleOne: boolean | null = null;

  @field({ persist: "idb" })
  private accessor _gulfRenderer: boolean | null = null;

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

  get agentMode() {
    return this._agentMode;
  }

  get consistentUI() {
    return this._consistentUI;
  }

  get enableDrivePickerInLiteMode() {
    return this._enableDrivePickerInLiteMode;
  }

  get force2DGraph() {
    return this._force2DGraph;
  }

  get generateForEach() {
    return this._generateForEach;
  }

  get googleOne() {
    return this._googleOne;
  }

  get gulfRenderer() {
    return this._gulfRenderer;
  }

  get mcp() {
    return this._mcp;
  }

  get opalAdk() {
    return this._opalAdk;
  }

  get outputTemplates() {
    return this._outputTemplates;
  }

  get requireConsentForGetWebpage() {
    return this._requireConsentForGetWebpage;
  }

  get requireConsentForOpenWebpage() {
    return this._requireConsentForOpenWebpage;
  }

  get streamGenWebpage() {
    return this._streamGenWebpage;
  }

  get streamPlanner() {
    return this._streamPlanner;
  }

  @field({ persist: "local" })
  private accessor _migrated = false;

  /**
   * Here for migrating from the old storage layer.
   * @deprecated
   */
  get isMigrated() {
    return this._migrated;
  }

  /**
   * Here for migrating from the old storage layer.
   * @deprecated
   */
  migrate(flags: RuntimeFlags) {
    const entries = Object.entries(flags) as [keyof RuntimeFlags, boolean][];
    for (const [flag, value] of entries) {
      this.#set(flag, value);
    }

    this._migrated = true;
  }

  #set(flag: keyof RuntimeFlags, value: boolean, onlyIfNull = false) {
    switch (flag) {
      case "agentMode": {
        if (onlyIfNull && this._agentMode !== null) return;
        this._agentMode = value;
        return;
      }

      case "consistentUI": {
        if (onlyIfNull && this._consistentUI !== null) return;
        this._consistentUI = value;
        return;
      }

      case "enableDrivePickerInLiteMode": {
        if (onlyIfNull && this._enableDrivePickerInLiteMode !== null) return;
        this._enableDrivePickerInLiteMode = value;
        return;
      }

      case "force2DGraph": {
        if (onlyIfNull && this._force2DGraph !== null) return;
        this._force2DGraph = value;
        return;
      }

      case "generateForEach": {
        if (onlyIfNull && this._generateForEach !== null) return;
        this._generateForEach = value;
        return;
      }

      case "googleOne": {
        if (onlyIfNull && this._googleOne !== null) return;
        this._googleOne = value;
        return;
      }

      case "gulfRenderer": {
        if (onlyIfNull && this._gulfRenderer !== null) return;
        this._gulfRenderer = value;
        return;
      }

      case "mcp": {
        if (onlyIfNull && this._mcp !== null) return;
        this._mcp = value;
        return;
      }

      case "opalAdk": {
        if (onlyIfNull && this._opalAdk !== null) return;
        this._opalAdk = value;
        return;
      }

      case "outputTemplates": {
        if (onlyIfNull && this._outputTemplates !== null) return;
        this._outputTemplates = value;
        return;
      }

      case "requireConsentForGetWebpage": {
        if (onlyIfNull && this._requireConsentForGetWebpage !== null) return;
        this._requireConsentForGetWebpage = value;
        return;
      }

      case "requireConsentForOpenWebpage": {
        if (onlyIfNull && this._requireConsentForOpenWebpage !== null) return;
        this._requireConsentForOpenWebpage = value;
        return;
      }

      case "streamGenWebpage": {
        if (onlyIfNull && this._streamGenWebpage !== null) return;
        this._streamGenWebpage = value;
        return;
      }

      case "streamPlanner": {
        if (onlyIfNull && this._streamPlanner !== null) return;
        this._streamPlanner = value;
        return;
      }
    }
  }

  #env: RuntimeFlags;
  constructor(id: string, env: RuntimeFlags) {
    super(id);

    this.#env = env;

    /**
     * Only populate the values if they nullish, in which case inherit from the
     * provided env.
     */
    this.isHydrated.then(() => {
      const onlyIfNull = true;

      this.#set("agentMode", env.agentMode, onlyIfNull);
      this.#set("consistentUI", env.consistentUI, onlyIfNull);
      this.#set(
        "enableDrivePickerInLiteMode",
        env.enableDrivePickerInLiteMode,
        onlyIfNull
      );
      this.#set("force2DGraph", env.force2DGraph, onlyIfNull);
      this.#set("generateForEach", env.generateForEach, onlyIfNull);
      this.#set("googleOne", env.googleOne, onlyIfNull);
      this.#set("gulfRenderer", env.gulfRenderer, onlyIfNull);
      this.#set("mcp", env.mcp, onlyIfNull);
      this.#set("opalAdk", env.opalAdk, onlyIfNull);
      this.#set("outputTemplates", env.outputTemplates, onlyIfNull);
      this.#set(
        "requireConsentForGetWebpage",
        env.requireConsentForGetWebpage,
        onlyIfNull
      );
      this.#set(
        "requireConsentForOpenWebpage",
        env.requireConsentForOpenWebpage,
        onlyIfNull
      );
      this.#set("streamGenWebpage", env.streamGenWebpage, onlyIfNull);
      this.#set("streamPlanner", env.streamPlanner, onlyIfNull);
    });
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
    this.#set(flag, this.#env[flag]);
  }
}
