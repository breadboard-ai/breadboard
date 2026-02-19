/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert/strict";
import { ShareController } from "../../../../../src/sca/controller/subcontrollers/editor/share-controller.js";

function makeController(): ShareController {
  return new ShareController("share_test", "ShareController");
}

suite("ShareController", () => {
  suite("stale getter", () => {
    test("false when versions match", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "5";
      ctrl.sharedVersion = "5";
      ctrl.hasPublicPermissions = true;
      assert.strictEqual(ctrl.stale, false);
    });

    test("false when editableVersion is empty", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "";
      ctrl.sharedVersion = "3";
      ctrl.hasPublicPermissions = true;
      assert.strictEqual(ctrl.stale, false);
    });

    test("false when sharedVersion is empty", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "5";
      ctrl.sharedVersion = "";
      ctrl.hasPublicPermissions = true;
      assert.strictEqual(ctrl.stale, false);
    });

    test("true for anyone-with-link visibility when versions differ", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "6";
      ctrl.sharedVersion = "5";
      ctrl.hasPublicPermissions = true;
      assert.strictEqual(ctrl.stale, true);
    });

    test("true for restricted visibility when versions differ", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "6";
      ctrl.sharedVersion = "5";
      ctrl.hasPublicPermissions = false;
      ctrl.hasOtherPermissions = true;
      assert.strictEqual(ctrl.stale, true);
    });

    test("false for only-you visibility even when versions differ", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "6";
      ctrl.sharedVersion = "5";
      ctrl.hasPublicPermissions = false;
      ctrl.hasOtherPermissions = false;
      assert.strictEqual(ctrl.stale, false);
    });
  });
});
