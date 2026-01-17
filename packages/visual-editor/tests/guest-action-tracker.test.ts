/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import {
  ComputedProperties,
  TrackedValues,
  computeProperties,
} from "../src/ui/utils/guest-action-tracker.js";
import assert, { deepStrictEqual } from "node:assert";

describe("Guest Action Tracker", () => {
  describe("computeProperties", () => {
    it("upgrades visitor to active", () => {
      // Start from new values
      let before: TrackedValues = {
        visitedPages: 0,
        signedIn: false,
        canAccess: false,
        opalsRun: 0,
        opalsCreated: 0,
      };

      // Increment visited pages
      let after: TrackedValues = {
        visitedPages: 1,
        signedIn: false,
        canAccess: false,
        opalsRun: 0,
        opalsCreated: 0,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(changed);
        deepStrictEqual(props, {
          user_type: "visitor",
        } satisfies ComputedProperties);
      }

      // Increment visited pages again
      before = after;
      after = {
        ...after,
        visitedPages: 2,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(changed);
        deepStrictEqual(props, {
          user_type: "active",
        } satisfies ComputedProperties);
      }

      // And again -- there should be no change anymore
      before = after;
      after = {
        ...after,
        visitedPages: 3,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(!changed);
        deepStrictEqual(props, {
          user_type: "active",
        } satisfies ComputedProperties);
      }
    });

    it("upgrades active to signed_in and back", () => {
      let before: TrackedValues = {
        visitedPages: 5,
        signedIn: false,
        canAccess: false,
        opalsRun: 0,
        opalsCreated: 0,
      };

      // Increment visited pages
      let after: TrackedValues = {
        visitedPages: 6,
        signedIn: true,
        canAccess: false,
        opalsRun: 0,
        opalsCreated: 0,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(changed);
        deepStrictEqual(props, {
          user_type: "signed_in",
        } satisfies ComputedProperties);
      }

      // Send signed in again
      before = after;
      after = {
        ...after,
        visitedPages: 6,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(!changed);
        deepStrictEqual(props, {
          user_type: "signed_in",
        } satisfies ComputedProperties);
      }

      // Sign out
      before = after;
      after = {
        ...after,
        visitedPages: 7,
        signedIn: false,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(changed);
        deepStrictEqual(props, {
          user_type: "active",
        } satisfies ComputedProperties);
      }
    });

    it("upgrades signed_in to can_access", () => {
      let before: TrackedValues = {
        visitedPages: 5,
        signedIn: true,
        canAccess: false,
        opalsRun: 0,
        opalsCreated: 0,
      };

      let after: TrackedValues = {
        visitedPages: 6,
        signedIn: true,
        canAccess: true,
        opalsRun: 0,
        opalsCreated: 0,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(changed);
        deepStrictEqual(props, {
          user_type: "can_access",
        } satisfies ComputedProperties);
      }

      // Send can_accesss in again
      before = after;
      after = {
        ...after,
        visitedPages: 6,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(!changed);
        deepStrictEqual(props, {
          user_type: "can_access",
        } satisfies ComputedProperties);
      }

      // Sign out
      before = after;
      after = {
        ...after,
        visitedPages: 7,
        signedIn: false,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(changed);
        deepStrictEqual(props, {
          user_type: "active",
        } satisfies ComputedProperties);
      }
    });

    it("upgrades can_access to engaged", () => {
      let before: TrackedValues = {
        visitedPages: 5,
        signedIn: true,
        canAccess: true,
        opalsRun: 0,
        opalsCreated: 0,
      };

      let after: TrackedValues = {
        visitedPages: 6,
        signedIn: true,
        canAccess: true,
        opalsRun: 1,
        opalsCreated: 0,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(changed);
        deepStrictEqual(props, {
          user_type: "engaged",
        } satisfies ComputedProperties);
      }

      // Also count created
      after = {
        ...after,
        opalsRun: 0,
        opalsCreated: 1,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(changed);
        deepStrictEqual(props, {
          user_type: "engaged",
        } satisfies ComputedProperties);
      }

      // Make sure it sticks
      before = after;
      after = {
        ...after,
        opalsCreated: 3,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(!changed);
        deepStrictEqual(props, {
          user_type: "engaged",
        } satisfies ComputedProperties);
      }

      // Sign out
      before = after;
      after = {
        ...after,
        visitedPages: 7,
        signedIn: false,
      };
      {
        const { changed, props } = computeProperties({ before, after });
        assert(changed);
        deepStrictEqual(props, {
          user_type: "active",
        } satisfies ComputedProperties);
      }
    });
  });
});
