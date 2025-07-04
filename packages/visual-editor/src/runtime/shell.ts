/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class Shell extends EventTarget {
  constructor(
    private readonly appName: string,
    private readonly appSubName: string
  ) {
    super();
  }

  setPageTitle(title: string | null) {
    const suffix = `${this.appName} [${this.appSubName}]`;
    if (title) {
      title = title.trim();
      window.document.title = `${title} - ${suffix}`;
      return;
    }

    window.document.title = suffix;
  }
}
