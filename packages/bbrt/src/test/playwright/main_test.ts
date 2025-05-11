/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from "@esm-bundle/chai";
import { BBRTMain } from "../../components/main.js";

describe("bbrt-main", () => {
  it("is an HTMLElement", () => {
    const c = new BBRTMain({
      connectionRedirectUrl: "",
      connectionServerUrl: "",
      plugins: { input: [] },
      googleDrive: { publishPermissions: [], publicApiKey: "" },
    });
    expect(c).instanceOf(HTMLElement);
  });
});
