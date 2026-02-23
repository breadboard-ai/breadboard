/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { makeUrl, parseUrl } from "../src/ui/navigation/urls.js";
import type { BaseUrlInit, MakeUrlInit } from "../src/ui/types/types.js";

const BASE_URL = "https://example.com";

function testSymmetrical(
  newUrl: string,
  oldUrl: string,
  init: MakeUrlInit
): void {
  test(oldUrl, () => {
    assert.deepEqual(makeUrl(init, BASE_URL, true), newUrl);
    assert.deepEqual(makeUrl(init, BASE_URL, false), oldUrl);
    assert.deepEqual(parseUrl(newUrl), init);
    assert.deepEqual(parseUrl(oldUrl), init);
  });
}

suite("home", () => {
  testSymmetrical(`${BASE_URL}/`, `${BASE_URL}/`, {
    page: "home",
    lite: false,
    new: false,
    colorScheme: undefined,
    guestPrefixed: false,
  });

  testSymmetrical(
    `${BASE_URL}/?lite=true&new=true`,
    `${BASE_URL}/?lite=true&new=true`,
    {
      page: "home",
      lite: true,
      new: true,
      colorScheme: undefined,
      guestPrefixed: false,
    }
  );

  testSymmetrical(`${BASE_URL}/?lite=true`, `${BASE_URL}/?lite=true`, {
    page: "home",
    lite: true,
    new: false,
    colorScheme: undefined,
    guestPrefixed: false,
  });

  test("default to home w/ canvas", () => {
    assert.deepEqual(parseUrl(`${BASE_URL}/`), {
      page: "home",
      lite: false,
      new: false,
      colorScheme: undefined,
      guestPrefixed: false,
    } satisfies MakeUrlInit);
  });

  test("preserves dev params", () => {
    testSymmetrical(
      `${BASE_URL}/?dev-foo=hello&dev-bar=`,
      `${BASE_URL}/?dev-foo=hello&dev-bar=`,
      {
        page: "home",
        lite: false,
        new: false,
        colorScheme: undefined,
        dev: {
          foo: "hello",
          bar: "",
          // Note we're casting here and below because while we do type the dev
          // object, the implementation doesn't actually care about the properties
          // as long as they start with "dev-". And since we'll be changing the
          // dev properties a lot, we don't want to have to update this test, so
          // that's good.
        } as object as BaseUrlInit["dev"],
        guestPrefixed: false,
      }
    );
  });
});

suite("app", () => {
  testSymmetrical(
    `${BASE_URL}/app/abc123`,
    `${BASE_URL}/?flow=drive:/abc123&mode=app`,
    {
      page: "graph",
      mode: "app",
      flow: "drive:/abc123",
      resourceKey: undefined,
      lite: false,
      colorScheme: undefined,
      guestPrefixed: false,
    }
  );

  testSymmetrical(
    `${BASE_URL}/app/abc123?resourcekey=ghi789`,
    `${BASE_URL}/?flow=drive:/abc123&resourcekey=ghi789&mode=app`,
    {
      page: "graph",
      mode: "app",
      flow: "drive:/abc123",
      resourceKey: "ghi789",
      lite: false,
      colorScheme: undefined,
      guestPrefixed: false,
    }
  );

  testSymmetrical(
    `${BASE_URL}/app/333?remix=true&lite=true`,
    `${BASE_URL}/?flow=drive:/333&remix=true&lite=true&mode=app`,
    {
      page: "graph",
      mode: "app",
      flow: "drive:/333",
      lite: true,
      remix: true,
      resourceKey: undefined,
      colorScheme: undefined,
      guestPrefixed: false,
    }
  );

  testSymmetrical(
    `${BASE_URL}/app/abc123?results=def456`,
    `${BASE_URL}/?flow=drive:/abc123&results=def456&mode=app`,
    {
      page: "graph",
      mode: "app",
      flow: "drive:/abc123",
      resourceKey: undefined,
      results: "def456",
      lite: false,
      colorScheme: undefined,
      guestPrefixed: false,
    }
  );

  test("old tab0 parameter", () => {
    assert.deepEqual(parseUrl(`${BASE_URL}/?tab0=drive:/abc123`), {
      page: "graph",
      mode: "canvas",
      flow: "drive:/abc123",
      resourceKey: undefined,
      colorScheme: undefined,
      lite: false,
      guestPrefixed: false,
    } satisfies MakeUrlInit);
  });

  test("invalid mode", () => {
    assert.deepEqual(parseUrl(`${BASE_URL}/?flow=drive:/abc123&mode=invalid`), {
      page: "graph",
      mode: "canvas",
      flow: "drive:/abc123",
      resourceKey: undefined,
      lite: false,
      colorScheme: undefined,
      guestPrefixed: false,
    } satisfies MakeUrlInit);
  });

  test("preserves dev params", () => {
    testSymmetrical(
      `${BASE_URL}/app/abc123?dev-foo=hello&dev-bar=`,
      `${BASE_URL}/?flow=drive:/abc123&mode=app&dev-foo=hello&dev-bar=`,
      {
        page: "graph",
        mode: "app",
        flow: "drive:/abc123",
        resourceKey: undefined,
        colorScheme: undefined,
        lite: false,
        dev: {
          foo: "hello",
          bar: "",
        } as object as BaseUrlInit["dev"],
        guestPrefixed: false,
      }
    );
  });
});

suite("canvas", () => {
  testSymmetrical(
    `${BASE_URL}/edit/abc123`,
    `${BASE_URL}/?flow=drive:/abc123&mode=canvas`,
    {
      page: "graph",
      mode: "canvas",
      flow: "drive:/abc123",
      resourceKey: undefined,
      lite: false,
      colorScheme: undefined,
      guestPrefixed: false,
    }
  );

  test("preserves dev params", () => {
    testSymmetrical(
      `${BASE_URL}/edit/abc123?dev-foo=hello&dev-bar=`,
      `${BASE_URL}/?flow=drive:/abc123&mode=canvas&dev-foo=hello&dev-bar=`,
      {
        page: "graph",
        mode: "canvas",
        flow: "drive:/abc123",
        resourceKey: undefined,
        colorScheme: undefined,
        lite: false,
        dev: {
          foo: "hello",
          bar: "",
        } as object as BaseUrlInit["dev"],
        guestPrefixed: false,
      }
    );
  });
});

suite("landing", () => {
  testSymmetrical(`${BASE_URL}/landing/`, `${BASE_URL}/landing/`, {
    page: "landing",
    redirect: {
      page: "home",
      new: false,
      redirectFromLanding: true,
      lite: false,
      colorScheme: undefined,
      guestPrefixed: true,
    },
    guestPrefixed: false,
  });

  testSymmetrical(
    `${BASE_URL}/landing/?geo-restriction=true&missing-scopes=true`,
    `${BASE_URL}/landing/?geo-restriction=true&missing-scopes=true`,
    {
      page: "landing",
      redirect: {
        page: "home",
        new: false,
        redirectFromLanding: true,
        lite: false,
        colorScheme: undefined,
        guestPrefixed: true,
      },
      geoRestriction: true,
      missingScopes: true,
      guestPrefixed: false,
    }
  );

  testSymmetrical(
    `${BASE_URL}/landing/?flow=drive:/abc123&mode=app`,
    `${BASE_URL}/landing/?flow=drive:/abc123&mode=app`,
    {
      page: "landing",
      redirect: {
        page: "graph",
        mode: "app",
        redirectFromLanding: true,
        flow: "drive:/abc123",
        resourceKey: undefined,
        lite: false,
        colorScheme: undefined,
        guestPrefixed: true,
      },
      guestPrefixed: false,
    }
  );

  testSymmetrical(
    `${BASE_URL}/landing/?flow=drive:/abc123&resourcekey=ghi789&results=def456&mode=app`,
    `${BASE_URL}/landing/?flow=drive:/abc123&resourcekey=ghi789&results=def456&mode=app`,
    {
      page: "landing",
      redirect: {
        page: "graph",
        mode: "app",
        redirectFromLanding: true,
        flow: "drive:/abc123",
        resourceKey: "ghi789",
        results: "def456",
        lite: false,
        colorScheme: undefined,
        guestPrefixed: true,
      },
      guestPrefixed: false,
    }
  );

  testSymmetrical(
    `${BASE_URL}/landing/?oauth_redirect=foo&flow=drive:/abc123&mode=app`,
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
        colorScheme: undefined,
        lite: false,
        guestPrefixed: true,
      },
      guestPrefixed: false,
    }
  );

  test("preserves dev params", () => {
    testSymmetrical(
      `${BASE_URL}/landing/?dev-foo=hello&dev-bar=`,
      `${BASE_URL}/landing/?dev-foo=hello&dev-bar=`,
      {
        page: "landing",
        redirect: {
          page: "home",
          new: false,
          redirectFromLanding: true,
          dev: {
            foo: "hello",
            bar: "",
          } as object as BaseUrlInit["dev"],
          lite: false,
          colorScheme: undefined,
          guestPrefixed: true,
        },
        dev: {
          foo: "hello",
          bar: "",
        } as object as BaseUrlInit["dev"],
        guestPrefixed: false,
      }
    );
  });
});

suite("guest prefix", () => {
  testSymmetrical(
    `${BASE_URL}/_app/app/abc123`,
    `${BASE_URL}/_app/?flow=drive:/abc123&mode=app`,
    {
      page: "graph",
      mode: "app",
      flow: "drive:/abc123",
      resourceKey: undefined,
      lite: false,
      colorScheme: undefined,
      guestPrefixed: true,
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
