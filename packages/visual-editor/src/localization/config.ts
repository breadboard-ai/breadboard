/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { configureLocalization, type LocaleModule } from "@lit/localize";
import {
  sourceLocale,
  targetLocales,
} from "../generated/localization/locale-codes.js";

// Non-standard Vite function. Detects all available locales at build time and
// substitutes static module names for the dynamic imports.
const localeModules = import.meta.glob("../generated/localization/*.ts");

const { setLocale } = configureLocalization({
  sourceLocale,
  targetLocales,
  loadLocale: (locale) => {
    const loader = localeModules[`../generated/localization/${locale}.ts`];
    if (!loader) {
      return Promise.reject(new Error(`Unknown locale: ${locale}`));
    }
    return loader() as Promise<LocaleModule>;
  },
});
export { setLocale };
