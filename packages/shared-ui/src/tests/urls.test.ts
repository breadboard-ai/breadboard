/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { makeUrl, type MakeUrlInit, parseUrl } from "../utils/urls.js";

const BASE_URL = "https://example.com";

function testSymmetrical(url: string, init: MakeUrlInit): void {
  test(url, () => {
    assert.deepEqual(makeUrl(init, BASE_URL), url);
    assert.deepEqual(parseUrl(url), init);
  });
}

suite("home", () => {
  testSymmetrical(`${BASE_URL}/?mode=canvas`, {
    page: "home",
    mode: "canvas",
  });

  testSymmetrical(`${BASE_URL}/?mode=app`, {
    page: "home",
    mode: "app",
  });

  test("default to home w/ canvas", () => {
    assert.deepEqual(parseUrl(`${BASE_URL}/`), {
      page: "home",
      mode: "canvas",
    });
  });
});

suite("app", () => {
  testSymmetrical(`${BASE_URL}/?flow=drive:/abc123&mode=app`, {
    page: "graph",
    mode: "app",
    flow: "drive:/abc123",
    resourceKey: undefined,
  });

  testSymmetrical(
    `${BASE_URL}/?flow=drive:/abc123&resourcekey=ghi789&mode=app`,
    {
      page: "graph",
      mode: "app",
      flow: "drive:/abc123",
      resourceKey: "ghi789",
    }
  );

  testSymmetrical(
    `${BASE_URL}/?flow=drive:/abc123&shared&results=def456&mode=app`,
    {
      page: "graph",
      mode: "app",
      flow: "drive:/abc123",
      resourceKey: undefined,
      results: "def456",
      shared: true,
    }
  );

  test("old tab0 parameter", () => {
    assert.deepEqual(parseUrl(`${BASE_URL}/?tab0=drive:/abc123`), {
      page: "graph",
      mode: "canvas",
      flow: "drive:/abc123",
      resourceKey: undefined,
    } satisfies MakeUrlInit);
  });

  test("invalid mode", () => {
    assert.deepEqual(parseUrl(`${BASE_URL}/?flow=drive:/abc123&mode=invalid`), {
      page: "graph",
      mode: "canvas",
      flow: "drive:/abc123",
      resourceKey: undefined,
    } satisfies MakeUrlInit);
  });
});

suite("canvas", () => {
  testSymmetrical(`${BASE_URL}/?flow=drive:/abc123&mode=canvas`, {
    page: "graph",
    mode: "canvas",
    flow: "drive:/abc123",
    resourceKey: undefined,
  });
});

suite("landing", () => {
  testSymmetrical(`${BASE_URL}/landing/`, {
    page: "landing",
    redirect: { page: "home", mode: "canvas", redirectFromLanding: true },
  });

  testSymmetrical(
    `${BASE_URL}/landing/?geo-restriction=true&missing-scopes=true`,
    {
      page: "landing",
      redirect: { page: "home", mode: "canvas", redirectFromLanding: true },
      geoRestriction: true,
      missingScopes: true,
    }
  );

  testSymmetrical(`${BASE_URL}/landing/?flow=drive:/abc123&mode=app`, {
    page: "landing",
    redirect: {
      page: "graph",
      mode: "app",
      redirectFromLanding: true,
      flow: "drive:/abc123",
      resourceKey: undefined,
    },
  });

  testSymmetrical(
    `${BASE_URL}/landing/?flow=drive:/abc123&resourcekey=ghi789&shared&results=def456&mode=app`,
    {
      page: "landing",
      redirect: {
        page: "graph",
        mode: "app",
        redirectFromLanding: true,
        flow: "drive:/abc123",
        resourceKey: "ghi789",
        results: "def456",
        shared: true,
      },
    }
  );

  testSymmetrical(
    `${BASE_URL}/landing/?flow=drive:/abc123&mode=app&oauth_redirect=foo`,
    {
      page: "landing",
      redirect: {
        page: "graph",
        mode: "app",
        redirectFromLanding: true,
        flow: "drive:/abc123",
        resourceKey: undefined,
      },
      oauthRedirect: "foo",
    }
  );
});

suite("parse errors", () => {
  test("parseUrl(<empty>)", () => {
    assert.throws(() => parseUrl(""));
  });

  test("parseUrl(<invalid>)", () => {
    assert.throws(() => parseUrl("not a url"));
  });
});
