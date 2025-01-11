/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type SharedUi = typeof import("@breadboard-ai/shared-ui");

let promise: undefined | Promise<SharedUi>;

export function loadSharedUi(): Promise<SharedUi> {
  return (promise ??= (async () => {
    const StringsHelper = await import("@breadboard-ai/shared-ui/strings");
    await StringsHelper.initFrom("@breadboard-ai/shared-ui/strings/en_US");
    return import("@breadboard-ai/shared-ui");
  })());
}
