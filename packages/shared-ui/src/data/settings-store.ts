/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import * as BreadboardUI_Types from "../types/types.js";

interface SettingsDB extends BreadboardUI_Types.SettingsList, idb.DBSchema {}

const SETTINGS_NAME = "settings";
const SETTINGS_VERSION = 7;

export class SettingsStore implements BreadboardUI_Types.SettingsStore {
  static #instance: SettingsStore;
  static instance() {
    if (!this.#instance) {
      this.#instance = new SettingsStore();
    }
    return this.#instance;
  }

  #settings: BreadboardUI_Types.Settings = {
    [BreadboardUI_Types.SETTINGS_TYPE.GENERAL]: {
      configuration: {
        extensible: false,
        description: `General Breadboard settings`,
        nameEditable: false,
        nameVisible: true,
      },
      items: new Map([
        [
          "Save Secrets",
          {
            name: "Save Secrets",
            description: "Whether you wish to have secrets saved automatically",
            value: true,
          },
        ],
        [
          "Auto Save Boards",
          {
            name: "Auto Save Boards",
            description:
              "Whether you wish to try and save boards automatically when they change",
            value: true,
          },
        ],
        [
          "Show Tooltips",
          {
            name: "Show Tooltips",
            description: "Toggles the tooltips on UI items",
            value: true,
          },
        ],
        [
          "Collapse Nodes by Default",
          {
            name: "Collapse Nodes by Default",
            description:
              "Whether you wish to have nodes in the graph collapsed by default",
            value: false,
          },
        ],
        [
          "Hide Embedded Board Selector When Empty",
          {
            name: "Hide Embedded Board Selector When Empty",
            description:
              "If there are no embedded boards in the current one, hide the selector",
            value: true,
          },
        ],
        [
          "Hide Advanced Ports on Nodes",
          {
            name: "Hide Advanced Ports on Nodes",
            description:
              "Toggles the visibility of $error, star (*), and control ports on nodes (unless connected)",
            value: true,
          },
        ],
        [
          "Show Experimental Components",
          {
            name: "Show Experimental Components",
            description:
              "Toggles the visibility of experimental features & steps",
            value: false,
          },
        ],
        [
          "Show Node Shortcuts",
          {
            name: "Show Node Shortcuts",
            description:
              "Toggles the visibility of common nodes next to the node selector",
            value: true,
          },
        ],
        [
          "Show Node Preview Values",
          {
            name: "Show Node Preview Values",
            description:
              "Toggles the visibility of configuration values in the graph",
            value: true,
          },
        ],
        [
          "Show Port Tooltips",
          {
            name: "Show Port Tooltips",
            description:
              "Toggles whether hovering over a port shows a tooltip with advanced port details",
            value: false,
          },
        ],
        [
          "Highlight Invalid Wires",
          {
            name: "Highlight Invalid Wires",
            description:
              "Toggles whether wires that have incompatible schema will be shown in red.",
            value: false,
          },
        ],
        [
          "Invert Zoom Scroll Direction",
          {
            name: "Invert Zoom Scroll Direction",
            description: "Inverts the board zoom scroll direction",
            value: false,
          },
        ],
        [
          "Show Port Types in Configuration",
          {
            name: "Show Port Types in Configuration",
            description:
              "Toggles whether or not to show a port's type information in the Component Configuration pane",
            value: false,
          },
        ],
        [
          "Use Local Secrets Only",
          {
            name: "Use Local Secrets Only",
            description:
              "When unchecked (default), the board server's secrets and locally-stored secrets will be used to run the board from that server. When checked, only locally-stored secrets will be used.",
            value: false,
          },
        ],
        [
          "Offer Configuration Enhancements",
          {
            name: "Offer Configuration Enhancements",
            description: "Toggles showing the component enhancement button",
            value: false,
          },
        ],
        [
          "Use TypeScript as Module default language",
          {
            name: "Use TypeScript as Module default language",
            description:
              "Sets TypeScript as the language when creating new modules",
            value: true,
          },
        ],
        [
          "Show subgraphs inline",
          {
            name: "Show subgraphs inline",
            description: "Shows subgraphs alongside the main graph",
            value: false,
          },
        ],
        [
          "Show additional sources",
          {
            name: "Show additional sources",
            description: "Toggles showing other locations to load from",
            value: false,
          },
        ],
        [
          "Enable autonaming",
          {
            name: "Enable autonaming",
            description:
              "Toggles the WIP feature where the flows and steps are automatically named according to their purpose (reload for setting to take effect)",
            value: false,
          },
        ],
        [
          "Enable Custom Step Creation",
          {
            name: "Enable Custom Step Creation",
            description: "Enables the creation of custom steps",
            value: false,
          },
        ],
        [
          "Show Assets in Graph",
          {
            name: "Show Assets in Graph",
            description: "Toggles the visibility of Assets in the graph",
            value: false,
          },
        ],
      ]),
    },
    [BreadboardUI_Types.SETTINGS_TYPE.SECRETS]: {
      configuration: {
        extensible: true,
        description: `Secrets that you want to store locally, such as API keys. When calling an API, the API provider's applicable privacy policy and terms apply. Please note that items in this list should have unique names. `,
        nameEditable: true,
        nameVisible: true,
      },
      items: new Map([]),
    },
    [BreadboardUI_Types.SETTINGS_TYPE.INPUTS]: {
      configuration: {
        extensible: true,
        description: `Inputs that the boards ask for in the middle of the run (also known as "bubbled inputs"), such as model names`,
        nameEditable: true,
        nameVisible: true,
      },
      items: new Map([]),
    },
    [BreadboardUI_Types.SETTINGS_TYPE.NODE_PROXY_SERVERS]: {
      configuration: {
        extensible: true,
        description:
          "Node proxy servers to use when running boards. Put the URL of the node proxy server in the first field and a comma-separated list of nodes to proxy in the second field.",
        nameEditable: true,
        nameVisible: true,
      },
      items: new Map([]),
    },
    [BreadboardUI_Types.SETTINGS_TYPE.CONNECTIONS]: {
      configuration: {
        extensible: false,
        description:
          "Third-party services boards can access. When you are signed into a service, any board can access and modify your data on that service.",
        nameEditable: false,
        nameVisible: false,
        customElement: "bb-connection-settings",
      },
      items: new Map([]),
    },
  };

  get values() {
    return structuredClone(this.#settings);
  }

  getSection(section: BreadboardUI_Types.SETTINGS_TYPE) {
    return this.#settings[section];
  }

  getItem(section: BreadboardUI_Types.SETTINGS_TYPE, name: string) {
    return this.#settings[section].items.get(name);
  }

  private constructor() {}

  async save(settings: BreadboardUI_Types.Settings) {
    const settingsDb = await idb.openDB<SettingsDB>(
      SETTINGS_NAME,
      SETTINGS_VERSION
    );

    for (const [store, data] of Object.entries(settings)) {
      const settingsStore = store as BreadboardUI_Types.SETTINGS_TYPE;
      if (settingsDb.objectStoreNames.contains(settingsStore)) {
        await settingsDb.clear(settingsStore);
      }

      const tx = settingsDb.transaction(settingsStore, "readwrite");
      await Promise.all([
        [...data.items.values()].map((setting) => {
          return tx.store.put(setting);
        }),
        tx.done,
      ]);
    }

    this.#settings = settings;
    settingsDb.close();
  }

  async restore() {
    let settingsFound = true;
    const settings = this.#settings;
    const settingsDb = await idb.openDB<SettingsDB>(
      SETTINGS_NAME,
      SETTINGS_VERSION,
      {
        upgrade(db) {
          settingsFound = false;
          for (const groupName of Object.keys(settings)) {
            const name = groupName as BreadboardUI_Types.SETTINGS_TYPE;
            if (db.objectStoreNames.contains(name)) continue;
            db.createObjectStore(name, {
              keyPath: "id",
              autoIncrement: true,
            });
          }
        },
      }
    );

    let skippedSettings = false;
    for (const store of settingsDb.objectStoreNames) {
      const items = await settingsDb.getAll(store);
      for (const item of items) {
        if (!this.#settings[store]) {
          continue;
        }

        if (
          store === BreadboardUI_Types.SETTINGS_TYPE.GENERAL &&
          !this.#settings[store].items.get(item.name)
        ) {
          skippedSettings = true;
          console.info(`[Settings] Skipping setting "${item.name}"`);
          continue;
        }

        this.#settings[store].items.set(item.name, item);
      }
    }

    settingsDb.close();

    if (skippedSettings) {
      console.info(
        `[Settings] Re-save your settings to remove deprecated values`
      );
    }

    if (!settingsFound) {
      // Store the initial copy of the settings.
      await this.save(this.#settings);
    }
  }
}
