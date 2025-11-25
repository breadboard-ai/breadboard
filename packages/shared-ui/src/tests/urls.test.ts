/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { makeUrl, parseUrl } from "../utils/urls.js";
import type { BaseUrlInit, MakeUrlInit } from "../types/types.js";

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
    lite: false,
    new: false,
  });

  testSymmetrical(`${BASE_URL}/?mode=app`, {
    page: "home",
    mode: "app",
    lite: false,
    new: false,
  });

  testSymmetrical(`${BASE_URL}/?mode=app&lite=true&new=true`, {
    page: "home",
    mode: "app",
    lite: true,
    new: true,
  });

  testSymmetrical(`${BASE_URL}/?mode=app&lite=true`, {
    page: "home",
    mode: "app",
    lite: true,
    new: false,
  });

  testSymmetrical(`${BASE_URL}/?mode=app&lite=true&remix=test`, {
    page: "home",
    mode: "app",
    lite: true,
    new: false,
    remix: "test",
  });

  test("default to home w/ canvas", () => {
    assert.deepEqual(parseUrl(`${BASE_URL}/`), {
      page: "home",
      mode: "canvas",
      lite: false,
      new: false,
    });
  });

  test("preserves dev params", () => {
    testSymmetrical(`${BASE_URL}/?mode=canvas&dev-foo=hello&dev-bar=`, {
      page: "home",
      mode: "canvas",
      lite: false,
      new: false,
      dev: {
        foo: "hello",
        bar: "",
        // Note we're casting here and below because while we do type the dev
        // object, the implementation doesn't actually care about the properties
        // as long as they start with "dev-". And since we'll be changing the
        // dev properties a lot, we don't want to have to update this test, so
        // that's good.
      } as object as BaseUrlInit["dev"],
    });
  });
});

suite("app", () => {
  testSymmetrical(`${BASE_URL}/?flow=drive:/abc123&mode=app`, {
    page: "graph",
    mode: "app",
    flow: "drive:/abc123",
    resourceKey: undefined,
    lite: false,
  });

  testSymmetrical(
    `${BASE_URL}/?flow=drive:/abc123&resourcekey=ghi789&mode=app`,
    {
      page: "graph",
      mode: "app",
      flow: "drive:/abc123",
      resourceKey: "ghi789",
      lite: false,
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
      lite: false,
    }
  );

  test("old tab0 parameter", () => {
    assert.deepEqual(parseUrl(`${BASE_URL}/?tab0=drive:/abc123`), {
      page: "graph",
      mode: "canvas",
      flow: "drive:/abc123",
      resourceKey: undefined,
      lite: false,
    } satisfies MakeUrlInit);
  });

  test("invalid mode", () => {
    assert.deepEqual(parseUrl(`${BASE_URL}/?flow=drive:/abc123&mode=invalid`), {
      page: "graph",
      mode: "canvas",
      flow: "drive:/abc123",
      resourceKey: undefined,
      lite: false,
    } satisfies MakeUrlInit);
  });

  test("preserves dev params", () => {
    testSymmetrical(
      `${BASE_URL}/?flow=drive:/abc123&mode=app&dev-foo=hello&dev-bar=`,
      {
        page: "graph",
        mode: "app",
        flow: "drive:/abc123",
        resourceKey: undefined,
        lite: false,
        dev: {
          foo: "hello",
          bar: "",
        } as object as BaseUrlInit["dev"],
      }
    );
  });
});

suite("canvas", () => {
  testSymmetrical(`${BASE_URL}/?flow=drive:/abc123&mode=canvas`, {
    page: "graph",
    mode: "canvas",
    flow: "drive:/abc123",
    resourceKey: undefined,
    lite: false,
  });

  test("preserves dev params", () => {
    testSymmetrical(
      `${BASE_URL}/?flow=drive:/abc123&mode=canvas&dev-foo=hello&dev-bar=`,
      {
        page: "graph",
        mode: "canvas",
        flow: "drive:/abc123",
        resourceKey: undefined,
        lite: false,
        dev: {
          foo: "hello",
          bar: "",
        } as object as BaseUrlInit["dev"],
      }
    );
  });
});

suite("landing", () => {
  testSymmetrical(`${BASE_URL}/landing/`, {
    page: "landing",
    redirect: {
      page: "home",
      new: false,
      mode: "canvas",
      redirectFromLanding: true,
      lite: false,
    },
  });

  testSymmetrical(
    `${BASE_URL}/landing/?geo-restriction=true&missing-scopes=true`,
    {
      page: "landing",
      redirect: {
        page: "home",
        new: false,
        mode: "canvas",
        redirectFromLanding: true,
        lite: false,
      },
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
      lite: false,
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
        lite: false,
      },
    }
  );

  testSymmetrical(
    `${BASE_URL}/landing/?oauth_redirect=foo&flow=drive:/abc123&mode=app`,
    {
      oauthRedirect: "foo",
      page: "landing",
      redirect: {
        page: "graph",
        mode: "app",
        oauthRedirect: "foo",
        redirectFromLanding: true,
        flow: "drive:/abc123",
        resourceKey: undefined,
        lite: false,
      },
    }
  );

  test("preserves dev params", () => {
    testSymmetrical(`${BASE_URL}/landing/?dev-foo=hello&dev-bar=`, {
      page: "landing",
      redirect: {
        page: "home",
        mode: "canvas",
        new: false,
        redirectFromLanding: true,
        dev: {
          foo: "hello",
          bar: "",
        } as object as BaseUrlInit["dev"],
        lite: false,
      },
      dev: {
        foo: "hello",
        bar: "",
      } as object as BaseUrlInit["dev"],
    });
  });
});

suite("parse errors", () => {
  test("parseUrl(<empty>)", () => {
    assert.throws(() => parseUrl(""));
  });

  test("parseUrl(<invalid>)", () => {
    assert.throws(() => parseUrl("not a url"));
  });
});
