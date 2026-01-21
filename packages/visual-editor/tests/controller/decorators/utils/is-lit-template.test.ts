/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  isLitTemplateResult,
  isLitTemplateResultRecursive,
} from "../../../../src/controller/decorators/utils/is-lit-template.js";
import { html, HTMLTemplateResult } from "lit";

suite("Lit Template", () => {
  test("should match templates", () => {
    assert(!isLitTemplateResult("initial"));
    assert(isLitTemplateResult(html`Hello world`));
  });

  test("should match recursively", () => {
    assert(isLitTemplateResultRecursive([html`Hello`]));
    assert(isLitTemplateResultRecursive(new Set([html`Hello`])));
    assert(isLitTemplateResultRecursive(new Map([["foo", html`Hello`]])));
    assert(
      isLitTemplateResultRecursive(
        new Map<string, Map<string, HTMLTemplateResult[]>>([
          ["a", new Map([["b", [html`Value`]]])],
        ])
      )
    );
  });
});
