/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, beforeEach, afterEach } from "node:test";
import { checkFetchAllowlist } from "../../src/ui/utils/fetch-allowlist.js";
import { setDOM, unsetDOM } from "../fake-dom.js";

suite("checkFetchAllowlist", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  const BASE = "https://appcatalyst.pa.googleapis.com";

  test("streamRunAgent requires accessToken in body", () => {
    const info = checkFetchAllowlist(`${BASE}/v1beta1/streamRunAgent`);
    assert.ok(info, "streamRunAgent should be in the allowlist");
    assert.strictEqual(
      info.shouldAddAccessTokenToJsonBody,
      true,
      "streamRunAgent should add accessToken to JSON body"
    );
  });

  test("uploadGeminiFile requires accessToken in body", () => {
    const info = checkFetchAllowlist(`${BASE}/v1beta1/uploadGeminiFile`);
    assert.ok(info);
    assert.strictEqual(info.shouldAddAccessTokenToJsonBody, true);
  });

  test("uploadBlobFile requires accessToken in body", () => {
    const info = checkFetchAllowlist(`${BASE}/v1beta1/uploadBlobFile`);
    assert.ok(info);
    assert.strictEqual(info.shouldAddAccessTokenToJsonBody, true);
  });

  test("generateWebpageStream requires accessToken in body", () => {
    const info = checkFetchAllowlist(`${BASE}/v1beta1/generateWebpageStream`);
    assert.ok(info);
    assert.strictEqual(info.shouldAddAccessTokenToJsonBody, true);
  });

  test("other v1beta1 endpoints do not add accessToken to body", () => {
    const info = checkFetchAllowlist(`${BASE}/v1beta1/executeStep`);
    assert.ok(info, "executeStep should be in the allowlist");
    assert.strictEqual(
      info.shouldAddAccessTokenToJsonBody,
      false,
      "executeStep should NOT add accessToken to JSON body"
    );
  });
});
