/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert/strict";
import { ShareController } from "../../../../../src/sca/controller/subcontrollers/editor/share-controller.js";
import { createMockEnvironment } from "../../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../data/default-flags.js";
import { makeUrl } from "../../../../../src/ui/navigation/urls.js";

function makeController(): ShareController {
  return new ShareController(
    "share_test",
    "ShareController",
    createMockEnvironment(defaultRuntimeFlags)
  );
}

suite("ShareController", () => {
  suite("stale getter", () => {
    test("false when versions match", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "5";
      ctrl.sharedVersion = "5";
      ctrl.hasBroadPermissions = true;
      assert.strictEqual(ctrl.stale, false);
    });

    test("false when editableVersion is empty", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "";
      ctrl.sharedVersion = "3";
      ctrl.hasBroadPermissions = true;
      assert.strictEqual(ctrl.stale, false);
    });

    test("false when sharedVersion is empty", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "5";
      ctrl.sharedVersion = "";
      ctrl.hasBroadPermissions = true;
      assert.strictEqual(ctrl.stale, false);
    });

    test("true for anyone-with-link visibility when versions differ", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "6";
      ctrl.sharedVersion = "5";
      ctrl.hasBroadPermissions = true;
      assert.strictEqual(ctrl.stale, true);
    });

    test("true for custom visibility when versions differ", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "6";
      ctrl.sharedVersion = "5";
      ctrl.hasBroadPermissions = false;
      ctrl.hasCustomPermissions = true;
      assert.strictEqual(ctrl.stale, true);
    });

    test("false for only-you visibility even when versions differ", () => {
      const ctrl = makeController();
      ctrl.editableVersion = "6";
      ctrl.sharedVersion = "5";
      ctrl.hasBroadPermissions = false;
      ctrl.hasCustomPermissions = false;
      assert.strictEqual(ctrl.stale, false);
    });
  });

  suite("appUrl", () => {
    function makeShare(opts: {
      guestConfig?: Partial<
        import("@breadboard-ai/types/opal-shell-protocol.js").GuestConfiguration
      >;
      hostOrigin?: URL;
    }): ShareController {
      const env = createMockEnvironment(defaultRuntimeFlags);
      const overriddenEnv = {
        ...env,
        hostOrigin: opts.hostOrigin ?? (undefined as unknown as URL),
        ...(opts.guestConfig
          ? { guestConfig: opts.guestConfig as typeof env.guestConfig }
          : {}),
      };
      return new ShareController("test", "test", overriddenEnv);
    }

    test("returns empty string when shareableFile is null", () => {
      const share = makeShare({});
      assert.strictEqual(share.appUrl, "");
    });

    test("uses shareSurface URL template when configured", () => {
      const share = makeShare({
        guestConfig: {
          shareSurface: "myapp",
          shareSurfaceUrlTemplates: {
            myapp:
              "https://myapp.example.com/view?id={fileId}&rk={resourceKey}",
          },
        },
      });
      share.shareableFile = { id: "abc123", resourceKey: "rk456" };
      assert.strictEqual(
        share.appUrl,
        "https://myapp.example.com/view?id=abc123&rk=rk456"
      );
    });

    test("shareSurface template omits empty resourceKey param", () => {
      const share = makeShare({
        guestConfig: {
          shareSurface: "myapp",
          shareSurfaceUrlTemplates: {
            myapp:
              "https://myapp.example.com/view?id={fileId}&rk={resourceKey}",
          },
        },
      });
      share.shareableFile = { id: "abc123", resourceKey: undefined };
      assert.strictEqual(
        share.appUrl,
        "https://myapp.example.com/view?id=abc123"
      );
    });

    test("falls back to makeUrl with hostOrigin when no shareSurface", () => {
      const hostOrigin = new URL("https://breadboard.example.com");
      const share = makeShare({ hostOrigin });
      share.shareableFile = { id: "file-xyz", resourceKey: undefined };
      assert.strictEqual(
        share.appUrl,
        makeUrl(
          {
            page: "graph",
            mode: "app",
            flow: "drive:/file-xyz",
            resourceKey: undefined,
            guestPrefixed: false,
          },
          hostOrigin
        )
      );
    });

    test("makeUrl branch includes resourceKey when present", () => {
      const hostOrigin = new URL("https://breadboard.example.com");
      const share = makeShare({ hostOrigin });
      share.shareableFile = { id: "file-xyz", resourceKey: "rk789" };
      assert.strictEqual(
        share.appUrl,
        makeUrl(
          {
            page: "graph",
            mode: "app",
            flow: "drive:/file-xyz",
            resourceKey: "rk789",
            guestPrefixed: false,
          },
          hostOrigin
        )
      );
    });

    test("returns empty string when no hostOrigin and no shareSurface", () => {
      const share = makeShare({});
      share.shareableFile = { id: "file-xyz", resourceKey: undefined };
      assert.strictEqual(share.appUrl, "");
    });

    test("shareSurface takes precedence over hostOrigin", () => {
      const share = makeShare({
        guestConfig: {
          shareSurface: "myapp",
          shareSurfaceUrlTemplates: {
            myapp: "https://myapp.example.com/view?id={fileId}",
          },
        },
        hostOrigin: new URL("https://breadboard.example.com"),
      });
      share.shareableFile = { id: "abc123", resourceKey: undefined };
      assert.ok(
        share.appUrl.startsWith("https://myapp.example.com"),
        share.appUrl
      );
    });

    test("ignores shareSurface when template map is missing", () => {
      const hostOrigin = new URL("https://breadboard.example.com");
      const share = makeShare({
        guestConfig: { shareSurface: "myapp" },
        hostOrigin,
      });
      share.shareableFile = { id: "abc123", resourceKey: undefined };
      assert.strictEqual(
        share.appUrl,
        makeUrl(
          {
            page: "graph",
            mode: "app",
            flow: "drive:/abc123",
            resourceKey: undefined,
            guestPrefixed: false,
          },
          hostOrigin
        )
      );
    });

    test("ignores shareSurface when key not found in template map", () => {
      const hostOrigin = new URL("https://breadboard.example.com");
      const share = makeShare({
        guestConfig: {
          shareSurface: "unknown-surface",
          shareSurfaceUrlTemplates: {
            myapp: "https://myapp.example.com/view?id={fileId}",
          },
        },
        hostOrigin,
      });
      share.shareableFile = { id: "abc123", resourceKey: undefined };
      assert.strictEqual(
        share.appUrl,
        makeUrl(
          {
            page: "graph",
            mode: "app",
            flow: "drive:/abc123",
            resourceKey: undefined,
            guestPrefixed: false,
          },
          hostOrigin
        )
      );
    });
  });
});
