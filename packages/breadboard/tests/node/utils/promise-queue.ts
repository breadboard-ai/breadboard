/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { PromiseQueue } from "../../../src/utils/promise-queue.js";
import {
  deepStrictEqual,
  doesNotReject,
  rejects,
  strictEqual,
} from "assert/strict";

// Helper function to create a promise that resolves after a delay
const createDelayedResolve = <T>(
  value: T,
  delay: number,
  callback?: () => void
): (() => Promise<T>) => {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => {
        callback?.(); // Call callback right before resolving
        resolve(value);
      }, delay);
    });
};

// Helper function to create a promise that rejects after a delay
const createDelayedReject = (
  reason: unknown,
  delay: number,
  callback?: () => void
): (() => Promise<never>) => {
  return () =>
    new Promise((_, reject) => {
      setTimeout(() => {
        callback?.(); // Call callback right before rejecting
        reject(reason);
      }, delay);
    });
};

describe("PromiseQueue", () => {
  it("should process promises sequentially in the order they are added", async () => {
    const queue = new PromiseQueue();
    const executionOrder: number[] = [];

    const task1 = queue.add(
      createDelayedResolve(1, 50, () => executionOrder.push(1))
    );
    const task2 = queue.add(
      createDelayedResolve(2, 20, () => executionOrder.push(2))
    ); // Shorter delay, but added second
    const task3 = queue.add(
      createDelayedResolve(3, 10, () => executionOrder.push(3))
    ); // Shortest delay, added third

    strictEqual(
      queue.size,
      2,
      "Initial queue size should be 2 after adding 3 tasks (1 processing)"
    );
    strictEqual(queue.processing, true, "Queue should be processing initially");

    const results = await Promise.all([task1, task2, task3]);

    deepStrictEqual(
      results,
      [1, 2, 3],
      "Results should match the resolved values in order"
    );
    deepStrictEqual(
      executionOrder,
      [1, 2, 3],
      "Execution order should match the order of addition"
    );
    strictEqual(
      queue.size,
      0,
      "Queue size should be 0 after all tasks complete"
    );
    strictEqual(
      queue.processing,
      false,
      "Queue should not be processing after completion"
    );
  });

  it("should handle promise rejections and continue processing subsequent tasks", async () => {
    const queue = new PromiseQueue();
    const executionOrder: (number | string)[] = [];

    const task1 = queue.add(
      createDelayedResolve(1, 30, () => executionOrder.push(1))
    );
    const task2 = queue.add(
      createDelayedReject("Error 2", 10, () => executionOrder.push("err2"))
    );
    const task3 = queue.add(
      createDelayedResolve(3, 20, () => executionOrder.push(3))
    );

    // Wait for all tasks to settle (resolve or reject)
    const results = await Promise.allSettled([task1, task2, task3]);

    // Check task1 (resolved)
    strictEqual(results[0].status, "fulfilled", "Task 1 should be fulfilled");
    strictEqual(
      (results[0] as PromiseFulfilledResult<number>).value,
      1,
      "Task 1 result"
    );

    // Check task2 (rejected)
    strictEqual(results[1].status, "rejected", "Task 2 should be rejected");
    strictEqual(
      (results[1] as PromiseRejectedResult).reason,
      "Error 2",
      "Task 2 rejection reason"
    );

    // Check task3 (resolved)
    strictEqual(results[2].status, "fulfilled", "Task 3 should be fulfilled");
    strictEqual(
      (results[2] as PromiseFulfilledResult<number>).value,
      3,
      "Task 3 result"
    );

    // Verify execution order
    deepStrictEqual(
      executionOrder,
      [1, "err2", 3],
      "Execution order should be correct including rejection"
    );

    strictEqual(queue.size, 0, "Queue size should be 0");
    strictEqual(queue.processing, false, "Queue should not be processing");
  });

  it("should return promises that resolve/reject with the correct values/reasons", async () => {
    const queue = new PromiseQueue();
    const expectedValue = { data: "success" };
    const expectedError = new Error("Task Failed");

    const p1 = queue.add(createDelayedResolve(expectedValue, 10));
    const p2 = queue.add(createDelayedReject(expectedError, 10));
    const p3 = queue.add(createDelayedResolve(123, 10));

    // Check resolution
    await doesNotReject(p1, "Promise 1 should resolve");
    const v1 = await p1;
    deepStrictEqual(v1, expectedValue, "Promise 1 resolved value mismatch");

    // Check rejection
    await rejects(
      p2,
      (err) => {
        strictEqual(err, expectedError, "Promise 2 rejection reason mismatch");
        return true; // Indicate the error is expected
      },
      "Promise 2 should reject with the correct error"
    );

    // Check resolution of third promise
    await doesNotReject(p3, "Promise 3 should resolve");
    const v3 = await p3;
    strictEqual(v3, 123, "Promise 3 resolved value mismatch");
  });

  it("should handle adding tasks while processing is ongoing", async () => {
    const queue = new PromiseQueue();
    const executionOrder: number[] = [];

    // Add initial tasks
    const p1 = queue.add(
      createDelayedResolve(1, 60, () => executionOrder.push(1))
    );
    const p2 = queue.add(
      createDelayedResolve(2, 20, () => executionOrder.push(2))
    );

    // Wait a bit, then add more tasks while the first one is likely still running
    await new Promise((res) => setTimeout(res, 30)); // Wait less than p1's delay

    strictEqual(
      queue.processing,
      true,
      "Queue should be processing before adding more tasks"
    );
    strictEqual(queue.size, 1, "Queue size should be 1 before adding more");

    const p3 = queue.add(
      createDelayedResolve(3, 15, () => executionOrder.push(3))
    );
    const p4 = queue.add(
      createDelayedResolve(4, 5, () => executionOrder.push(4))
    );

    strictEqual(
      queue.size,
      3,
      "Queue size should be 3 after adding more tasks"
    ); // p2, p3, p4 waiting

    // Wait for all tasks to complete
    const results = await Promise.all([p1, p2, p3, p4]);

    deepStrictEqual(
      results,
      [1, 2, 3, 4],
      "Results should be in order of addition"
    );
    deepStrictEqual(
      executionOrder,
      [1, 2, 3, 4],
      "Execution order should be maintained"
    );
    strictEqual(queue.size, 0, "Final queue size should be 0");
    strictEqual(queue.processing, false, "Queue should stop processing");
  });

  it("should handle an empty queue correctly", () => {
    const queue = new PromiseQueue();
    strictEqual(queue.size, 0, "Initial size should be 0");
    strictEqual(queue.processing, false, "Should not be processing initially");
    // No tasks added, nothing should happen or throw error
  });

  it("should correctly report size and processing status", async () => {
    const queue = new PromiseQueue();
    strictEqual(queue.size, 0);
    strictEqual(queue.processing, false);

    const p1 = queue.add(createDelayedResolve(1, 50));
    strictEqual(queue.size, 0); // Task 1 taken immediately
    strictEqual(queue.processing, true);

    const p2 = queue.add(createDelayedResolve(2, 10));
    strictEqual(queue.size, 1); // Task 2 is waiting
    strictEqual(queue.processing, true);

    const p3 = queue.add(createDelayedResolve(3, 10));
    strictEqual(queue.size, 2); // Task 3 is waiting
    strictEqual(queue.processing, true);

    await p1; // Wait for first task
    strictEqual(queue.size, 1); // Task 2 is processing, task 3 waiting
    strictEqual(queue.processing, true);

    await p2; // Wait for second task
    strictEqual(queue.size, 0); // Task 3 is processing
    strictEqual(queue.processing, true);

    await p3; // Wait for third task
    strictEqual(queue.size, 0); // All done
    strictEqual(queue.processing, false);
  });
});
