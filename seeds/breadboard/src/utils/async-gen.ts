/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type AsyncGenNext<T> = (value: T) => Promise<void>;
type AsyncGenCallback<T> = (next: AsyncGenNext<T>) => Promise<void>;

/**
 * Converts async/await style code into an async generator.
 * Useful when you need to combine arrow-style functions and yield.
 *
 * Example:
 *
 * ```ts
 * async function* foo() {
 *   yield 1;
 *   yield* asyncGen(async (next) => {
 *     await next(2);
 *     await next(3);
 *   });
 *   yield 4;
 * }
 *
 * for await (const val of foo()) {
 *   console.log(val);
 * }
 * ```
 *
 * This code will print:
 *
 * ```
 * 1
 * 2
 * 3
 * 4
 * ```
 *
 * @param callback A callback that will be called with a `next` function.
 * The callback should call `next` with the next value to yield.
 * @returns An async generator.
 */
export const asyncGen = <T>(callback: AsyncGenCallback<T>) => {
  type MaybeT = T | undefined;
  let proceedToNext: (() => void) | undefined;
  let nextCalled: (value: MaybeT) => void;
  let nextThrew: (err: Error) => void;

  const next = async (result: T) => {
    nextCalled(result);
    return new Promise<void>((resolve) => {
      proceedToNext = resolve;
    });
  };

  return {
    [Symbol.asyncIterator]() {
      let waitForCallbackToCallNext: Promise<MaybeT>;
      let done = false;
      const resolver = (
        resolve: (value: MaybeT) => void,
        reject: (value: unknown) => void
      ) => {
        nextCalled = resolve;
        nextThrew = reject;
      };

      waitForCallbackToCallNext = new Promise<MaybeT>(resolver);
      proceedToNext = () => {
        callback(next)
          .then(() => {
            done = true;
            nextCalled(undefined);
          })
          .catch((err) => {
            nextThrew(err);
          });
      };
      return {
        async next() {
          proceedToNext && proceedToNext();
          const value = await waitForCallbackToCallNext;
          waitForCallbackToCallNext = new Promise<MaybeT>(resolver);
          return { done, value };
        },
      } as AsyncIterator<T, void, unknown>;
    },
  };
};
