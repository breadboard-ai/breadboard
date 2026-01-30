/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, mock, suite, test } from "node:test";
import { StatusUpdatesService } from "../../../src/sca/services/status-updates-service.js";
import { StatusUpdatesController } from "../../../src/sca/controller/subcontrollers/global/status-updates-controller.js";
import { VisualEditorStatusUpdate } from "../../../src/ui/types/types.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";

suite("StatusUpdatesService", () => {
  let fetchMock: ReturnType<(typeof mock)["fn"]>;

  beforeEach(() => {
    setDOM();
    fetchMock = mock.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  function mockFetchResponse(response: VisualEditorStatusUpdate[] | "error") {
    fetchMock.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      } as Response)
    );
  }

  function mockFetchNetworkError() {
    fetchMock.mock.mockImplementation(() =>
      Promise.reject(new Error("Network error"))
    );
  }

  test("start() begins polling with controller", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_svc_1",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    const mockUpdates: VisualEditorStatusUpdate[] = [
      { date: "2026-01-15T10:00:00Z", text: "Test update", type: "info" },
    ];
    mockFetchResponse(mockUpdates);

    const service = new StatusUpdatesService();
    await service.start(controller);
    await controller.isSettled;

    assert.strictEqual(controller.updates.length, 1);
    assert.strictEqual(controller.updates[0].text, "Test update");
    assert.strictEqual(fetchMock.mock.callCount(), 1);

    service.stop();
  });

  test("stop() halts polling", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_svc_2",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    mockFetchResponse([]);

    const service = new StatusUpdatesService();
    await service.start(controller);

    const callsAfterFirstPoll = fetchMock.mock.callCount();
    assert.ok(callsAfterFirstPoll >= 1, "Should have polled at least once");

    service.stop();

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(
      fetchMock.mock.callCount(),
      callsAfterFirstPoll,
      "Fetch should not be called after stopping"
    );
  });

  test("handles server error response gracefully", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_svc_3",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    mockFetchResponse("error");

    const service = new StatusUpdatesService();
    await service.start(controller);

    assert.deepStrictEqual(controller.updates, []);
    assert.strictEqual(fetchMock.mock.callCount(), 1);

    service.stop();
  });

  test("handles network errors gracefully", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_svc_4",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    mockFetchNetworkError();

    const service = new StatusUpdatesService();
    await service.start(controller);

    assert.deepStrictEqual(controller.updates, []);
    assert.strictEqual(fetchMock.mock.callCount(), 1);

    service.stop();
  });

  test("start() is idempotent", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_svc_5",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    mockFetchResponse([]);

    const service = new StatusUpdatesService();

    // Start twice - second start should be no-op
    await service.start(controller);
    await service.start(controller);

    assert.strictEqual(
      fetchMock.mock.callCount(),
      1,
      "Should have polled exactly once"
    );

    service.stop();
  });

  test("passes /updates URL to fetch", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_svc_6",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    mockFetchResponse([]);

    const service = new StatusUpdatesService();
    await service.start(controller);

    assert.strictEqual(fetchMock.mock.calls[0].arguments[0], "/updates");

    service.stop();
  });
});
