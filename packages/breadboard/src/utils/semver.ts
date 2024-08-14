/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type Major = number;
type Minor = number;
type Patch = number;

export type SemVer = `${Major}.${Minor}.${Patch}`;

export class SemanticVersioning {
  #major: Major = 0;
  #minor: Minor = 0;
  #patch: Patch = 1;

  constructor(version?: SemVer) {
    if (!version) {
      return;
    }

    this.version = version;
  }

  get version(): SemVer {
    return `${this.#major}.${this.#minor}.${this.#patch}`;
  }

  set version(version: SemVer) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match) {
      throw new Error(`Version "${version}" is not SemVer formatted`);
    }

    this.#major = Number.parseInt(match[1]);
    this.#minor = Number.parseInt(match[2]);
    this.#patch = Number.parseInt(match[3]);
  }

  major() {
    this.#major++;
    this.#minor = 0;
    this.#patch = 0;
  }

  minor() {
    this.#minor++;
    this.#patch = 0;
  }

  patch() {
    this.#patch++;
  }
}
