/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, it } from "node:test";
import type { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import {
  ACTION_TRACKER_STORAGE_KEY,
  ComputedProperties,
  GuestActionTracker,
  UserType,
} from "../src/ui/utils/guest-action-tracker.js";
import { deepStrictEqual } from "node:assert";

const trackedProperties: ComputedProperties[] = [];
const mockShellHostProtocol = {
  trackProperties: (props: ComputedProperties) => trackedProperties.push(props),
} as unknown as OpalShellHostProtocol;

function currentUserType(): UserType | undefined {
  return trackedProperties.at(-1)?.user_type;
}

describe("Guest Action Tracker", () => {
  beforeEach(() => {
    globalThis.localStorage.removeItem(ACTION_TRACKER_STORAGE_KEY);
    trackedProperties.length = 0;
  });

  describe("Property computer", () => {
    it("upgrades to 'visitor'", () => {
      const tracker = new GuestActionTracker(mockShellHostProtocol, true);
      tracker.incrementVisitedPages();
      deepStrictEqual(currentUserType(), "one_time");
      tracker.incrementVisitedPages();
      deepStrictEqual(currentUserType(), "visitor");
      tracker.incrementVisitedPages();
      deepStrictEqual(currentUserType(), "visitor");
      deepStrictEqual(trackedProperties.length, 2);
    });

    it("upgrades to 'signed-in' and back", () => {
      const tracker = new GuestActionTracker(mockShellHostProtocol, true);
      tracker.incrementVisitedPages();
      deepStrictEqual(currentUserType(), "one_time");
      tracker.updateSignedInStatus(true);
      deepStrictEqual(currentUserType(), "signed_in");
      tracker.updateSignedInStatus(false);
      deepStrictEqual(currentUserType(), "one_time");
      tracker.updateSignedInStatus(true);
      deepStrictEqual(currentUserType(), "signed_in");
      tracker.incrementVisitedPages();
      tracker.updateSignedInStatus(false);
      deepStrictEqual(currentUserType(), "visitor");
      tracker.updateSignedInStatus(true);
      deepStrictEqual(currentUserType(), "signed_in");
      tracker.updateSignedInStatus(true);
      deepStrictEqual(currentUserType(), "signed_in");
      deepStrictEqual(trackedProperties.length, 6);
    });

    it("upgrades to 'can_access' and back", () => {
      const tracker = new GuestActionTracker(mockShellHostProtocol, true);
      tracker.incrementVisitedPages();
      deepStrictEqual(currentUserType(), "one_time");
      tracker.updateSignedInStatus(true);
      deepStrictEqual(currentUserType(), "signed_in");
      tracker.updateCanAccessStatus(true);
      deepStrictEqual(currentUserType(), "can_access");
      tracker.updateCanAccessStatus(true);
      deepStrictEqual(currentUserType(), "can_access");
      tracker.updateCanAccessStatus(false);
      deepStrictEqual(currentUserType(), "signed_in");
      deepStrictEqual(trackedProperties.length, 4);

      tracker.updateCanAccessStatus(true);
      deepStrictEqual(currentUserType(), "can_access");
      tracker.updateSignedInStatus(false);
      deepStrictEqual(currentUserType(), "one_time");
      tracker.updateSignedInStatus(true);
      deepStrictEqual(currentUserType(), "signed_in");
    });

    it("upgrades 'can_access' to 'engaged' by incrementing opals created", () => {
      const tracker = new GuestActionTracker(mockShellHostProtocol, true);
      tracker.updateCanAccessStatus(true);
      deepStrictEqual(currentUserType(), "can_access");
      tracker.incrementOpalsCreated();
      deepStrictEqual(currentUserType(), "engaged");
      tracker.incrementOpalsRan();
      deepStrictEqual(currentUserType(), "engaged");
      deepStrictEqual(trackedProperties.length, 2);
    });

    it("upgrades 'can_access' to 'engaged' by incrementing opals ran", () => {
      const tracker = new GuestActionTracker(mockShellHostProtocol, true);
      tracker.updateCanAccessStatus(true);
      deepStrictEqual(currentUserType(), "can_access");
      tracker.incrementOpalsRan();
      deepStrictEqual(currentUserType(), "engaged");
      tracker.incrementOpalsCreated();
      deepStrictEqual(currentUserType(), "engaged");
      deepStrictEqual(trackedProperties.length, 2);
    });

    it("handles additional sign in/access changes when already `engaged`", () => {
      const tracker = new GuestActionTracker(mockShellHostProtocol, true);
      tracker.updateCanAccessStatus(true);
      deepStrictEqual(currentUserType(), "can_access");
      tracker.incrementOpalsRan();
      deepStrictEqual(currentUserType(), "engaged");
      tracker.updateSignedInStatus(true);
      deepStrictEqual(currentUserType(), "engaged");
      tracker.updateCanAccessStatus(true);
      deepStrictEqual(currentUserType(), "engaged");
      deepStrictEqual(trackedProperties.length, 2);
    });

    it("upgrades back to 'engaged' after signing back in", () => {
      const tracker = new GuestActionTracker(mockShellHostProtocol, true);
      tracker.updateCanAccessStatus(true);
      deepStrictEqual(currentUserType(), "can_access");
      tracker.incrementOpalsRan();
      deepStrictEqual(currentUserType(), "engaged");
      tracker.updateSignedInStatus(false);
      deepStrictEqual(currentUserType(), "one_time");
      tracker.updateSignedInStatus(true);
      deepStrictEqual(currentUserType(), "signed_in");
      tracker.updateCanAccessStatus(true);
      deepStrictEqual(currentUserType(), "engaged");
    });
  });
});
