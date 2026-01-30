/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../../ui/strings/helper.js";
import { makeTrigger } from "../binder.js";

const Strings = StringsHelper.forSection("Global");

export const bind = makeTrigger();

/**
 * Trigger that updates the page title when the graph title changes.
 *
 * Replaces the Shell.setPageTitle() method from the legacy Runtime.
 * Updates document.title reactively when controller.editor.graph.title changes.
 */
export function registerPageTitleTrigger() {
  bind.register("Page Title Trigger", () => {
    const { controller } = bind;
    const title = controller.editor.graph.title;

    const appName = Strings.from("APP_NAME");
    const appSubName = Strings.from("SUB_APP_NAME");
    const suffix = `${appName} [${appSubName}]`;

    if (title) {
      window.document.title = `${title.trim()} - ${suffix}`;
    } else {
      window.document.title = suffix;
    }
  });
}
