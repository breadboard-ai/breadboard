/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShellSplash } from "./components/shell/shell-splash.js";
import { ShellMain } from "./components/shell/shell-main.js";
import { setAppLocale } from "./localization/localization.js";
import { sca } from "./sca/sca.js";

async function bootstrap() {
  const splash = new ShellSplash();
  document.body.append(splash);

  const scaInstance = sca();
  await Promise.all([scaInstance.controller.isHydrated, setAppLocale("en-US")]);

  splash.remove();
  return scaInstance;
}

(async function init() {
  const scaInstance = await bootstrap();

  const main = new ShellMain({ sca: scaInstance });
  document.body.append(main);
})();
