/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import { loadBundleAsync } from "../../../src/sca/utils/load-bundle.js";
import { makeTestServices } from "../helpers/mock-services.js";
import type { AppServices } from "../../../src/sca/types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockCalls = Array<{ arguments: any[] }>;

describe("loadBundleAsync", () => {
  let services: AppServices;

  beforeEach(() => {
    ({ services } = makeTestServices());
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("loads the first JS file when no slug is provided (root agent)", async () => {
    mock.method(services.api, "listFiles", async () => [
      "App.jsx",
      "bundle.js",
      "style.css",
    ]);
    const getFile = mock.method(
      services.api, "getFile", async () => "console.log('ok')"
    );
    const send = mock.method(
      services.hostCommunication, "send", async () => {}
    );

    await loadBundleAsync("t-root", services);

    // Should load bundle.js (first .js file).
    assert.equal(
      (getFile.mock.calls as MockCalls)[0].arguments[1],
      "bundle.js"
    );

    // Should send render message.
    const msg = (send.mock.calls as MockCalls)[0].arguments[0];
    assert.equal(msg.type, "render");
    assert.equal(msg.code, "console.log('ok')");
  });

  it("scopes file lookup to slug subdirectory for subagents", async () => {
    mock.method(services.api, "listFiles", async () => [
      "bundle.js",           // root agent's bundle — should be ignored
      "style.css",           // root agent's CSS — should be ignored
      "research/bundle.js",  // THIS agent's bundle
      "research/style.css",  // THIS agent's CSS
      "other/bundle.js",     // sibling agent — should be ignored
    ]);

    const getFile = mock.method(
      services.api,
      "getFile",
      async (_id: string, path: string) =>
        path.endsWith(".js") ? "// js" : "/* css */"
    );
    const send = mock.method(
      services.hostCommunication, "send", async () => {}
    );

    await loadBundleAsync("t-sub", services, "research");

    // Should have loaded research/bundle.js and research/style.css.
    const calls = getFile.mock.calls as MockCalls;
    assert.equal(calls.length, 2);
    assert.equal(calls[0].arguments[1], "research/bundle.js");
    assert.equal(calls[1].arguments[1], "research/style.css");

    // Render message should carry both code and CSS.
    const msg = (send.mock.calls as MockCalls)[0].arguments[0];
    assert.equal(msg.code, "// js");
    assert.equal(msg.css, "/* css */");
  });

  it("ignores sibling and root files when slug is provided", async () => {
    mock.method(services.api, "listFiles", async () => [
      "root-bundle.js",
      "sibling/app.js",
      "deep/nested/bundle.js",  // Only this matches slug "deep/nested"
    ]);
    const getFile = mock.method(
      services.api, "getFile", async () => "// nested"
    );

    await loadBundleAsync("t-deep", services, "deep/nested");

    assert.equal(
      (getFile.mock.calls as MockCalls)[0].arguments[1],
      "deep/nested/bundle.js"
    );
  });

  it("logs error when no JS file matches the slug scope", async () => {
    mock.method(services.api, "listFiles", async () => [
      "root-bundle.js",   // exists, but not under slug
      "other/app.js",     // exists, but wrong slug
    ]);

    const consoleMock = mock.method(console, "error", () => {});
    const send = mock.method(
      services.hostCommunication, "send", async () => {}
    );

    await loadBundleAsync("t-empty", services, "research");

    // Should have logged an error mentioning the slug.
    assert.equal(consoleMock.mock.calls.length, 1);
    assert.ok(
      String((consoleMock.mock.calls as MockCalls)[0].arguments[0]).includes("slug: research")
    );

    // No render message should have been sent.
    assert.equal((send.mock.calls as MockCalls).length, 0);
  });

  it("treats null slug the same as undefined (root agent)", async () => {
    mock.method(services.api, "listFiles", async () => ["app.js"]);
    const getFile = mock.method(
      services.api, "getFile", async () => "// root"
    );

    await loadBundleAsync("t-null", services, null);

    assert.equal(
      (getFile.mock.calls as MockCalls)[0].arguments[1],
      "app.js"
    );
  });
});
