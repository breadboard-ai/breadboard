/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { configureLocalization, RuntimeConfiguration } from "@lit/localize";

const locales = import.meta.glob("./generated/locales/*.ts");

export const { setLocale: setAppLocale } = configureLocalization({
  sourceLocale: "en",
  targetLocales: ["de-DE", "en-US"],
  loadLocale: (locale) => {
    console.log(locale);
    (
      locales[`./generated/locales/${locale}.ts`]() as ReturnType<
        RuntimeConfiguration["loadLocale"]
      >
    ).then((x) => {
      console.log(x);
    });
    return locales[`./generated/locales/${locale}.ts`]() as ReturnType<
      RuntimeConfiguration["loadLocale"]
    >;
  },
});
