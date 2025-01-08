/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguagePack, LanguagePackEntry } from "../types/types";

class Strings<T extends LanguagePackEntry> {
  constructor(private lang: T) {}

  from(key: string) {
    if (typeof this.lang[key] === "string") {
      return this.lang[key];
    }

    if (typeof this.lang[key] === "object" && this.lang[key] !== null) {
      return this.lang[key].str;
    }

    return "__MISSING_VALUE__";
  }
}

let currentLanguage: LanguagePack;
export async function initFrom(language: LanguagePack) {
  currentLanguage = language;
}

export function forSection<T extends keyof LanguagePack>(section: T) {
  return new Strings(currentLanguage[section]);
}

export function from<T extends LanguagePack, Y extends keyof T>(
  lib: T,
  name: Y
) {
  return new Strings(lib[name] as LanguagePackEntry);
}
