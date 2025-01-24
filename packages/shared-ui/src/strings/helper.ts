/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguagePack, LanguagePackEntry } from "../types/types";

class Strings<T extends LanguagePackEntry> {
  constructor(
    private name: string,
    private values: T,
    private warnIfMissing = false
  ) {}

  from(key: string) {
    if (typeof this.values[key] === "string") {
      return this.values[key];
    }

    if (typeof this.values[key] === "object" && this.values[key] !== null) {
      return this.values[key].str;
    }

    if (this.warnIfMissing) {
      console.warn(
        `Missing language pack key "${key}" from section ${this.name}`
      );
    }
    return key.toUpperCase();
  }
}

let currentLanguage: LanguagePack;
export async function initFrom(language: LanguagePack) {
  currentLanguage = language;
}

export function forSection<T extends keyof LanguagePack>(section: T) {
  if (!currentLanguage) {
    currentLanguage = {
      ActivityLog: {},
      AppPreview: {},
      CommandPalette: {},
      ComponentSelector: {},
      Editor: {},
      Global: {},
      KitSelector: {},
      ProjectListing: {},
      UIController: {},
      WorkspaceOutline: {},
    };
  }
  return new Strings(section, currentLanguage[section]);
}

export function from<T extends LanguagePack, Y extends keyof T>(
  lib: T,
  name: Y,
  warnIfMissing = false
) {
  return new Strings(
    name as string,
    lib[name] as LanguagePackEntry,
    warnIfMissing
  );
}
