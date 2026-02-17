/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  ConsentController,
  ConsentKey,
  ConsentRecord,
  createConsentKey,
  stringifyScope,
} from "../../../../../src/sca/controller/subcontrollers/global/consent-controller.js";
import {
  ConsentAction,
  ConsentType,
  ConsentUIType,
} from "@breadboard-ai/types";
import { unwrap } from "../../../../../src/sca/controller/decorators/utils/wrap-unwrap.js";

function consentTestFactory(
  name: string,
  uiType: ConsentUIType,
  action: ConsentAction,
  expectation: Map<ConsentKey, ConsentRecord>
) {
  return async function () {
    const store = new ConsentController(name, "ConsentController");
    await store.isHydrated;

    const request = {
      graphUrl: "foo",
      scope: "scope",
      type: ConsentType.OPEN_WEBPAGE,
    };
    store.queryConsent(request, uiType);
    await store.isSettled;

    const modalCount = uiType === ConsentUIType.MODAL ? 1 : 0;
    const inAppCount = uiType === ConsentUIType.IN_APP ? 1 : 0;

    assert.equal(store.pendingModal.length, modalCount);
    assert.equal(store.pendingInApp.length, inAppCount);

    const collection =
      uiType === ConsentUIType.MODAL ? store.pendingModal : store.pendingInApp;
    assert.deepStrictEqual(collection[0], {
      request,
      askUsingUiType: uiType,
    });

    // Now resolve.
    store.updatePendingRequest(collection[0], action);
    await store.isSettled;

    assert.equal(store.pendingModal.length, 0);
    assert.equal(store.pendingInApp.length, 0);
    assert.deepStrictEqual(unwrap(store.consents), expectation);
  };
}

function consentTestSuiteFactory(uiType: ConsentUIType) {
  return function () {
    test(
      `Query (${uiType} - allow)`,
      consentTestFactory(
        `Consent_${uiType}_allow`,
        uiType,
        ConsentAction.ALLOW,
        new Map()
      )
    );

    test(
      `Query (${uiType} - always allow)`,
      consentTestFactory(
        `Consent_${uiType}_always_allow`,
        uiType,
        ConsentAction.ALWAYS_ALLOW,
        new Map([
          [
            "foo|scope|OPEN_WEBPAGE",
            {
              graphUrl: "foo",
              scope: "scope",
              type: ConsentType.OPEN_WEBPAGE,
              allow: true,
            },
          ],
        ])
      )
    );

    test(
      `Query (${uiType} - deny)`,
      consentTestFactory(
        `Consent_${uiType}_deny`,
        uiType,
        ConsentAction.DENY,
        new Map()
      )
    );

    test(
      `Query (${uiType} - always deny)`,
      consentTestFactory(
        `Consent_${uiType}_always_deny`,
        uiType,
        ConsentAction.ALWAYS_DENY,
        new Map([
          [
            "foo|scope|OPEN_WEBPAGE",
            {
              graphUrl: "foo",
              scope: "scope",
              type: ConsentType.OPEN_WEBPAGE,
              allow: false,
            },
          ],
        ])
      )
    );
  };
}

suite("ConsentController", () => {
  test("stringifyScope", async () => {
    assert.strictEqual(stringifyScope({ a: 1, b: 2 }), `{"a":1,"b":2}`);

    // Sorted.
    assert.strictEqual(stringifyScope({ b: 1, a: 2 }), `{"a":2,"b":1}`);
  });

  test("createConsentKey", async () => {
    assert.strictEqual(
      createConsentKey({
        graphUrl: "foo",
        scope: {},
        type: ConsentType.GET_ANY_WEBPAGE,
      }),
      `foo|{}|GET_ANY_WEBPAGE`
    );

    assert.strictEqual(
      createConsentKey({
        graphUrl: "bar",
        scope: "scope",
        type: ConsentType.OPEN_WEBPAGE,
      }),
      `bar|scope|OPEN_WEBPAGE`
    );
  });

  suite("query (In App)", consentTestSuiteFactory(ConsentUIType.IN_APP));
  suite("query (Modal)", consentTestSuiteFactory(ConsentUIType.MODAL));

  test("clear consent", async () => {
    const store = new ConsentController("Clearable", "ConsentController");
    await store.isHydrated;

    const request = {
      graphUrl: "foo",
      scope: "scope",
      type: ConsentType.OPEN_WEBPAGE,
    };
    store.queryConsent(request, ConsentUIType.IN_APP);
    await store.isSettled;

    assert.equal(store.pendingModal.length, 0);
    assert.equal(store.pendingInApp.length, 1);

    // Resolve and store.
    store.updatePendingRequest(
      store.pendingInApp[0],
      ConsentAction.ALWAYS_ALLOW
    );
    await store.isSettled;

    // Create another instance of the store and check that the permission exists.
    const store2 = new ConsentController("Clearable", "ConsentController");
    await store2.isHydrated;

    assert.deepStrictEqual(
      unwrap(store2.consents),
      new Map([
        [
          "foo|scope|OPEN_WEBPAGE",
          {
            graphUrl: "foo",
            scope: "scope",
            type: ConsentType.OPEN_WEBPAGE,
            allow: true,
          },
        ],
      ]),
      "Store contents do not match"
    );

    // Now clear everything.
    store2.clearAllConsents();
    await store2.isSettled;
    assert.deepStrictEqual(unwrap(store2.consents), new Map());
  });
});
