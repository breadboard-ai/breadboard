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
import type { AppEnvironment } from "../../../../../src/sca/environment/environment.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";
import { type AgentEvent } from "../../../../../src/a2/agent/agent-event.js";

type UserFeedbackConfig = {
  productId: string;
  bucket?: string;
  productVersion?: string;
  flow?: string;
  report?: {
    description: string;
    [key: string]: unknown;
  };
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
  let mockEnv: AppEnvironment;
  let windowWithUserFeedback: WindowWithUserFeedbackApi;
  let providedConfig: UserFeedbackConfig;
  let providedProductData: Record<string, string> | undefined;

  before(() => {
    setDOM();
  });

  after(() => {
    unsetDOM();
  });

  beforeEach(async () => {
    windowWithUserFeedback = globalThis.window as WindowWithUserFeedbackApi;
    mockEnv = {
      environmentName: "test-env",
      hostOrigin: new URL("http://localhost"),
      googleDrive: {
        apiEndpoint: undefined,
        broadPermissions: [],
      },
      buildInfo: {
        packageJsonVersion: "1.0.0",
        gitCommitHash: "abc1234",
      },
      deploymentConfig: {
        GOOGLE_FEEDBACK_PRODUCT_ID: "test-product-id",
        GOOGLE_FEEDBACK_BUCKET: "test-bucket",
      },
      shellHost: {
        setOneGoogleBarVisible: mock.fn(),
      },
    } as unknown as AppEnvironment;

    controller = new FeedbackController("Feedback", "FeedbackController", mockEnv);
    await controller.isHydrated;

    const mockApi = {
      startFeedback: mock.fn(
        (
          config: UserFeedbackConfig,
          productData?: Record<string, string>
        ) => {
          if (config.onLoadCallback) config.onLoadCallback();
          providedConfig = config;
          providedProductData = productData;
        }
      ),
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
    providedProductData = undefined;
  });

  test("Initial status is closed", () => {
    assert.strictEqual(controller.status, "closed");
  });

  test("open() sets status to loading then open on success", async () => {
    const openPromise = controller.open();
    assert.strictEqual(controller.status, "loading");
    await openPromise;
    assert.strictEqual(controller.status, "open");
  });

  test("open() failures handling - missing config", async () => {
    const noEnvController = new FeedbackController(
      "Feedback",
      "FeedbackController",
      undefined as unknown as AppEnvironment
    );
    await noEnvController.open();
    assert.strictEqual(noEnvController.status, "closed");
  });

  test("open() failures handling - missing product ID", async () => {
    (
      mockEnv as {
        deploymentConfig: { GOOGLE_FEEDBACK_PRODUCT_ID: string | undefined };
      }
    ).deploymentConfig.GOOGLE_FEEDBACK_PRODUCT_ID = undefined;
    await controller.open();
    assert.strictEqual(controller.status, "closed");
  });

  test("open() failures handling - missing bucket", async () => {
    (
      mockEnv as {
        deploymentConfig: { GOOGLE_FEEDBACK_BUCKET: string | undefined };
      }
    ).deploymentConfig.GOOGLE_FEEDBACK_BUCKET = undefined;
    await controller.open();
    assert.strictEqual(controller.status, "closed");
  });

  test("close() sets status to closed", async () => {
    controller.status = "open";
    await controller.isSettled;
    controller.close();
    assert.strictEqual(controller.status, "closed");
  });

  test("callback sets status to closed", async () => {
    const openPromise = controller.open();
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
    const openPromise = controller.open();
    const openPromise2 = controller.open();
    await Promise.all([openPromise, openPromise2]);
    assert.strictEqual(controller.status, "open");
  });

  test("open() with flow='submit' and explicit description configures api correctly", async () => {
    const description = "Test Headless Feedback";
    const productData = { foo: "bar" };
    await controller.open({
      productData,
      flow: "submit",
      description,
    });

    assert.strictEqual(providedConfig.flow, "submit");
    assert.deepStrictEqual(providedConfig.report, { description });
    assert.strictEqual(controller.entries[controller.entries.length - 1].status, "loaded");
  });

  test("open() with bucketSuffix and baseBucket concatenates correctly", async () => {
    await controller.open({
      bucketSuffix: "opie",
    });
    assert.strictEqual(providedConfig.bucket, "test-bucket_opie");
  });

  test("open() with bucketSuffix and missing baseBucket uses bucketSuffix", async () => {
    (
      mockEnv as {
        deploymentConfig: { GOOGLE_FEEDBACK_BUCKET: string | undefined };
      }
    ).deploymentConfig.GOOGLE_FEEDBACK_BUCKET = undefined;
    await controller.open({
      bucketSuffix: "opie",
    });
    assert.strictEqual(providedConfig.bucket, "opie");
  });

  test("open() with flow='submit' triggers an error status if description is missing", async () => {
    const productData = { foo: "bar", baz: "qux" };
    
    // Reset spy captured config
    providedConfig = undefined as unknown as UserFeedbackConfig;
    
    await controller.open({
      productData,
      flow: "submit",
    } as unknown as Parameters<FeedbackController["open"]>[0]);

    assert.strictEqual(providedConfig, undefined); // API not called
    const lastEntry = controller.entries[controller.entries.length - 1];
    assert.strictEqual(lastEntry.status, "error");
    assert.match(lastEntry.errorMessage || "", /Headless feedback submission requires a valid 'description'/);
  });

  test("open() with agentEvents formats and sends conversation in productData", async () => {
    const events: AgentEvent[] = [
      { start: { objective: { parts: [{ text: "Solve world hunger" }] } } },
      { thought: { text: "Thinking of a recipe..." } },
    ];
    await controller.open({
      agentEvents: [events],
    });

    assert.ok(providedProductData);
    assert.strictEqual(providedProductData.conversation.includes("START OBJECTIVE:\nSolve world hunger"), true);
    assert.strictEqual(providedProductData.conversation.includes("THOUGHT:\nThinking of a recipe..."), true);
  });

  test("open() with multiple agentEvents arrays formats and separates them in productData", async () => {
    const session1: AgentEvent[] = [
      { start: { objective: { parts: [{ text: "Session 1 objective" }] } } },
    ];
    const session2: AgentEvent[] = [
      { start: { objective: { parts: [{ text: "Session 2 objective" }] } } },
    ];
    await controller.open({
      agentEvents: [session1, session2],
    });

    assert.ok(providedProductData);
    assert.strictEqual(providedProductData.conversation.includes("=== Agent Session #1 ==="), true);
    assert.strictEqual(providedProductData.conversation.includes("START OBJECTIVE:\nSession 1 objective"), true);
    assert.strictEqual(providedProductData.conversation.includes("=== Agent Session #2 ==="), true);
    assert.strictEqual(providedProductData.conversation.includes("START OBJECTIVE:\nSession 2 objective"), true);
  });
});
