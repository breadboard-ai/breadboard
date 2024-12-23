/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";
import { ReactiveAppState } from "./app.js";

export interface AppPersister {
  save(app: ReactiveAppState): Promise<Result<void>>;
  load(): Promise<Result<ReactiveAppState | null>>;
}

const APP_LOCALSTORAGE_KEY = "bbrt-v3/app";

export class LocalStorageAppPersister implements AppPersister {
  async save(app: ReactiveAppState): Promise<Result<void>> {
    return resultify(() =>
      // throws if the data is too large
      localStorage.setItem(APP_LOCALSTORAGE_KEY, JSON.stringify(app.data))
    );
  }

  async load(): Promise<Result<ReactiveAppState | null>> {
    const data = resultify(() => localStorage.getItem(APP_LOCALSTORAGE_KEY));
    if (!data.ok) {
      return data;
    }
    const value = data.value;
    if (!value) {
      return { ok: true, value: null };
    }
    const parsed = resultify(() => JSON.parse(value));
    if (!parsed.ok) {
      return parsed;
    }
    return {
      ok: true,
      value: new ReactiveAppState(parsed.value),
    };
  }
}
