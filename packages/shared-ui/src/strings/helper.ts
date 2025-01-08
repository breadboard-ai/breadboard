/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type LanguagePack = Record<string, { str: string; desc?: string } | string>;

class Strings {
  constructor(private lang: LanguagePack) {}

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

export function from(lib: LanguagePack) {
  return new Strings(lib);
}
