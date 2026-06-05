/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";
import { WorkbenchSplitterController } from "./workbench-splitter-controller.js";

export { WorkbenchSplitterController };

export class WorkbenchController extends RootController {
  @field()
  accessor eligible = false;

  @field({ persist: "session" })
  accessor view: "workbench" | "classic" = "workbench";

  @field({ persist: "session" })
  accessor runsOpen = false;

  readonly splitter: WorkbenchSplitterController;

  constructor(id: string, name: string) {
    super(id, name);
    this.splitter = new WorkbenchSplitterController(
      `${id}_Splitter`,
      "WorkbenchSplitterController"
    );
  }
}
