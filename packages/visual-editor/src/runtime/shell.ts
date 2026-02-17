/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Legacy Shell class.
 *
 * @deprecated All Shell functionality has been migrated to SCA:
 * - Page title: Handled by SCA page title trigger (shell-triggers.ts)
 * - Status updates: Handled by StatusUpdatesController and StatusUpdatesService
 *
 * This class is retained only for API compatibility during the transition
 * period and will be removed in a future release.
 */
export class Shell extends EventTarget {}
