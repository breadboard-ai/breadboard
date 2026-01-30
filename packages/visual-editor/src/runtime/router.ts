/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @deprecated Router functionality implemented in SCA RouterController.
 *
 * This class is maintained only for backward compatibility with code that
 * still listens for RuntimeURLChangeEvent (main-base.ts history management).
 *
 * **Migration Path:**
 * - Replace `runtime.router.parsedUrl` with `sca.controller.router.parsedUrl`
 * - Replace `runtime.router.go()` with `sca.controller.router.go()`
 * - Replace `runtime.router.clearFlowParameters()` with `sca.controller.router.clearFlowParameters()`
 * - Replace RuntimeURLChangeEvent listeners with reactive signal consumption
 */
export class Router extends EventTarget { }
