/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OnboardingItemDescriptor } from "../../../types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

export type { OnboardingItemDescriptor };

/**
 * Ordered registry of all onboarding items. Items are shown in this order,
 * one at a time. Each item declares which mode(s) it applies to.
 *
 * To add a new onboarding item, append a descriptor here.
 */
const REGISTRY: OnboardingItemDescriptor[] = [
  {
    id: "first-run",
    mode: "both",
    textKey: "LABEL_FIRST_RUN",
  },
  {
    id: "lite-remix",
    mode: "lite",
    textKey: "ONBOARDING_LITE_REMIX",
  },
  {
    id: "advanced-editor",
    mode: "lite",
    textKey: "ONBOARDING_ADVANCED_EDITOR",
  },
  {
    id: "standalone-remix",
    mode: "standalone",
    titleKey: "ONBOARDING_STANDALONE_REMIX_TITLE",
    textKey: "ONBOARDING_STANDALONE_REMIX_TEXT",
  },
  {
    id: "replay-warning",
    mode: "both",
    titleKey: "ONBOARDING_REPLAY_WARNING_TITLE",
    textKey: "ONBOARDING_REPLAY_WARNING_TEXT",
  },
];

/**
 * Manages onboarding tooltips across modes (lite / standalone).
 *
 * - Items are defined in an ordered registry.
 * - The `dismissed` set is persisted to IDB so acknowledgements survive refresh.
 * - `currentItem(mode)` returns the first non-dismissed item visible in
 *   the given mode.
 */
export class OnboardingController extends RootController {
  /**
   * The app's current mode, set once by the entry point after SCA creation.
   * Determines which registry items are visible.
   */
  appMode: "lite" | "standalone" = "standalone";

  /**
   * Set of onboarding item IDs the user has acknowledged.
   * Persisted to IndexedDB so dismissals survive page refreshes.
   */
  @field({ persist: "idb", deep: true })
  private accessor _dismissed = new Set<string>();

  /** Readonly view of dismissed item IDs. */
  get dismissed(): ReadonlySet<string> {
    if (!this.hydrated) return new Set();
    return this._dismissed;
  }

  /**
   * Returns the first non-dismissed item matching the given mode,
   * or `null` if all items for that mode have been dismissed.
   */
  currentItem(mode: "lite" | "standalone"): OnboardingItemDescriptor | null {
    for (const item of REGISTRY) {
      if (this.hydrated && this._dismissed.has(item.id)) continue;
      if (item.mode === "both" || item.mode === mode) {
        return item;
      }
    }
    return null;
  }

  /**
   * Check whether the given item ID is the current (next-to-show) item
   * for the app's actual mode. Used by tooltips to decide whether to render.
   */
  isCurrentItem(id: string): boolean {
    const current = this.currentItem(this.appMode);
    return current?.id === id;
  }

  /** Mark an item as dismissed. Persisted automatically. */
  dismiss(id: string): void {
    this._dismissed.add(id);
  }

  /** Check whether a specific item has been dismissed. */
  isDismissed(id: string): boolean {
    if (!this.hydrated) return false;
    return this._dismissed.has(id);
  }

  /** Clear all dismissals (useful for dev/testing). */
  reset(): void {
    this._dismissed.clear();
  }

  /** Look up a registry item by ID. */
  getItem(id: string): OnboardingItemDescriptor | null {
    return REGISTRY.find((item) => item.id === id) ?? null;
  }
}
