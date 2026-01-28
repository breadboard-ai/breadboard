/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import {
  suite,
  test,
  beforeEach,
  afterEach,
  mock,
  before,
  after,
} from "node:test";
import { FeedbackController } from "../../../../../src/sca/controller/subcontrollers/global/feedback-controller.js";
import { GlobalConfig } from "../../../../../src/ui/contexts/global-config.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

type UserFeedbackConfig = {
  productId: string;
  bucket?: string;
  productVersion?: string;
  callback?: () => void;
  onLoadCallback?: () => void;
};

type UserFeedbackApi = {
  startFeedback(
    configuration: UserFeedbackConfig,
    productData?: { [key: string]: string }
  ): void;
};

type WindowWithUserFeedbackApi = Window &
  typeof globalThis & {
    userfeedback?: { api: UserFeedbackApi };
  };

suite("FeedbackController", () => {
  let controller: FeedbackController;
  let mockGlobalConfig: GlobalConfig;
  let windowWithUserFeedback: WindowWithUserFeedbackApi;
  let providedConfig: UserFeedbackConfig;

  before(() => {
    setDOM();
  });

  after(() => {
    unsetDOM();
  });

  beforeEach(async () => {
    windowWithUserFeedback = globalThis.window as WindowWithUserFeedbackApi;
    controller = new FeedbackController("Feedback");
    await controller.isHydrated;

    mockGlobalConfig = {
      environmentName: "test-env",
      hostOrigin: new URL("http://localhost"),
      googleDrive: {
        publishPermissions: [],
      },
      buildInfo: {
        packageJsonVersion: "1.0.0",
        gitCommitHash: "abc1234",
      },
      GOOGLE_FEEDBACK_PRODUCT_ID: "test-product-id",
      GOOGLE_FEEDBACK_BUCKET: "test-bucket",
    } as unknown as GlobalConfig;

    const mockApi = {
      startFeedback: mock.fn((config: UserFeedbackConfig) => {
        if (config.onLoadCallback) config.onLoadCallback();
        providedConfig = config;
      }),
    };
    windowWithUserFeedback.userfeedback = { api: mockApi };

    // Spy on document.body.appendChild to capture the script and trigger load.
    mock.method(document.body, "appendChild", (node: Node) => {
      if (node instanceof HTMLElement && node.tagName === "SCRIPT") {
        setImmediate(() => {
          node.dispatchEvent(new Event("load"));
        });
      }
      return node;
    });
  });

  afterEach(() => {
    mock.reset();
    windowWithUserFeedback.userfeedback = undefined;
  });

  test("Initial status is closed", () => {
    assert.strictEqual(controller.status, "closed");
  });

  test("open() sets status to loading then open on success", async () => {
    const openPromise = controller.open(mockGlobalConfig);
    assert.strictEqual(controller.status, "loading");
    await openPromise;
    assert.strictEqual(controller.status, "open");
  });

  test("open() failures handling - missing config", async () => {
    await controller.open(undefined as unknown as GlobalConfig);
    assert.strictEqual(controller.status, "closed");
  });

  test("open() failures handling - missing product ID", async () => {
    mockGlobalConfig.GOOGLE_FEEDBACK_PRODUCT_ID = undefined;
    await controller.open(mockGlobalConfig);
    assert.strictEqual(controller.status, "closed");
  });

  test("open() failures handling - missing bucket", async () => {
    mockGlobalConfig.GOOGLE_FEEDBACK_BUCKET = undefined;
    await controller.open(mockGlobalConfig);
    assert.strictEqual(controller.status, "closed");
  });

  test("close() sets status to closed", async () => {
    controller.status = "open";
    await controller.isSettled;
    controller.close();
    assert.strictEqual(controller.status, "closed");
  });

  test("callback sets status to closed", async () => {
    const openPromise = controller.open(mockGlobalConfig);
    await openPromise;
    assert.strictEqual(controller.status, "open");

    if (!providedConfig.callback) {
      assert.fail("No callback provided");
    }

    providedConfig.callback.call(controller);
    await controller.isSettled;
    assert.strictEqual(controller.status, "closed");
  });

  test("double open is inert", async () => {
    const openPromise = controller.open(mockGlobalConfig);
    const openPromise2 = controller.open(mockGlobalConfig);
    await Promise.all([openPromise, openPromise2]);
    assert.strictEqual(controller.status, "open");
  });
});
