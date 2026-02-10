/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeFlagManager, RuntimeFlags } from "@breadboard-ai/types";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

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
  private accessor _onDemandUI: boolean | null = null;

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
    if (this._agentMode === null)
      throw new Error("agentMode was not set by environment");
    return this._agentMode;
  }

  get consistentUI() {
    if (this._consistentUI === null)
      throw new Error("consistentUI was not set by environment");
    return this._consistentUI;
  }

  get enableDrivePickerInLiteMode() {
    if (this._enableDrivePickerInLiteMode === null)
      throw new Error("enableDrivePickerInLiteMode was not set by environment");
    return this._enableDrivePickerInLiteMode;
  }

  get enableGoogleDriveTools() {
    if (this._enableGoogleDriveTools === null) {
      throw new Error("enableGoogleDriveTools was not set by environment");
    }
    return this._enableGoogleDriveTools;
  }

  get enableResumeAgentRun() {
    if (this._enableResumeAgentRun === null) {
      throw new Error("enableResumeAgentRun was not set by environment");
    }
    return this._enableResumeAgentRun;
  }

  get force2DGraph() {
    if (this._force2DGraph === null)
      throw new Error("force2DGraph was not set by environment");
    return this._force2DGraph;
  }

  get onDemandUI() {
    if (this._onDemandUI === null)
      throw new Error("onDemandUI was not set by environment");
    return this._onDemandUI;
  }

  get googleOne() {
    if (this._googleOne === null)
      throw new Error("googleOne was not set by environment");
    return this._googleOne;
  }

  get gulfRenderer() {
    if (this._gulfRenderer === null)
      throw new Error("gulfRenderer was not set by environment");
    return this._gulfRenderer;
  }

  get mcp() {
    if (this._mcp === null) throw new Error("mcp was not set by environment");
    return this._mcp;
  }

  get opalAdk() {
    if (this._opalAdk === null)
      throw new Error("opalAdk was not set by environment");
    return this._opalAdk;
  }

  get outputTemplates() {
    if (this._outputTemplates === null)
      throw new Error("outputTemplates was not set by environment");
    return this._outputTemplates;
  }

  get requireConsentForGetWebpage() {
    if (this._requireConsentForGetWebpage === null)
      throw new Error("requireConsentForGetWebpage was not set by environment");
    return this._requireConsentForGetWebpage;
  }

  get requireConsentForOpenWebpage() {
    if (this._requireConsentForOpenWebpage === null)
      throw new Error(
        "requireConsentForOpenWebpage was not set by environment"
      );
    return this._requireConsentForOpenWebpage;
  }

  get streamGenWebpage() {
    if (this._streamGenWebpage === null)
      throw new Error("streamGenWebpage was not set by environment");
    return this._streamGenWebpage;
  }

  get streamPlanner() {
    if (this._streamPlanner === null)
      throw new Error("streamPlanner was not set by environment");
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
    if (typeof value !== "boolean") value = null as unknown as boolean;
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

      case "enableGoogleDriveTools": {
        if (onlyIfNull && this._enableGoogleDriveTools !== null) return;
        this._enableGoogleDriveTools = value;
        return;
      }

      case "enableResumeAgentRun": {
        if (onlyIfNull && this._enableResumeAgentRun !== null) return;
        this._enableResumeAgentRun = value;
        return;
      }

      case "onDemandUI": {
        if (onlyIfNull && this._onDemandUI !== null) return;
        this._onDemandUI = value;
        return;
      }
    }
  }

  #env: RuntimeFlags;
  constructor(controllerId: string, persistenceId: string, env: RuntimeFlags) {
    super(controllerId, persistenceId);

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
        "enableGoogleDriveTools",
        env.enableGoogleDriveTools,
        onlyIfNull
      );
      this.#set(
        "enableDrivePickerInLiteMode",
        env.enableDrivePickerInLiteMode,
        onlyIfNull
      );
      this.#set("force2DGraph", env.force2DGraph, onlyIfNull);
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
      this.#set("enableResumeAgentRun", env.enableResumeAgentRun, onlyIfNull);
      this.#set("onDemandUI", env.onDemandUI, onlyIfNull);
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
