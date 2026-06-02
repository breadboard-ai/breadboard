/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { iconSubstitute } from "../../src/ui/utils/icon-substitute.js";

suite("iconSubstitute", () => {
  test("returns valid Google Symbols for standard types", () => {
    assert.equal(iconSubstitute("content"), "text_fields");
    assert.equal(iconSubstitute("generative-text"), "spark");
    assert.equal(iconSubstitute("generative"), "spark");
    assert.equal(iconSubstitute("ask-user"), "chat_mirror");
    assert.equal(iconSubstitute("map-search"), "map_search");
    assert.equal(iconSubstitute("web-search"), "search");
    assert.equal(iconSubstitute("file"), "upload");
    assert.equal(iconSubstitute("gdrive"), "drive");
    assert.equal(iconSubstitute("drawable"), "draw");
    assert.equal(iconSubstitute("youtube"), "video_youtube");
    assert.equal(iconSubstitute("display"), "responsive_layout");
    assert.equal(iconSubstitute("output"), "responsive_layout");
  });

  test("returns valid Google Symbols for Google Drive MIME types", () => {
    assert.equal(
      iconSubstitute("application/vnd.google-apps.spreadsheet"),
      "sheets"
    );
    assert.equal(
      iconSubstitute("application/vnd.google-apps.document"),
      "docs"
    );
    assert.equal(
      iconSubstitute("application/vnd.google-apps.presentation"),
      "drive_presentation"
    );
    assert.equal(iconSubstitute("application/vnd.google-apps.drawing"), "draw");
    assert.equal(iconSubstitute("application/vnd.google-apps.folder"), "folder");
  });

  test("returns 'drive' as safe fallback for unrecognized Google Apps MIME types", () => {
    assert.equal(
      iconSubstitute("application/vnd.google-apps.site"),
      "drive"
    );
    assert.equal(
      iconSubstitute("application/vnd.google-apps.form"),
      "drive"
    );
    assert.equal(
      iconSubstitute("application/vnd.google-apps.unknown"),
      "drive"
    );
  });

  test("returns source string for unknown or null/undefined types", () => {
    assert.equal(iconSubstitute("custom-icon"), "custom-icon");
    assert.equal(iconSubstitute(null), null);
    assert.equal(iconSubstitute(undefined), undefined);
  });
});
