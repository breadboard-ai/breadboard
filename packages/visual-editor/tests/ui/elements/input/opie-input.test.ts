/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, after, before, mock } from "node:test";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { createMockEnvironment } from "../../../sca/helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../../sca/controller/data/default-flags.js";
import {
  makeTestController,
  makeTestServices,
} from "../../../sca/helpers/index.js";
import { OpieInput } from "../../../../src/ui/elements/input/opie-input.js";
import type { SCA } from "../../../../src/sca/sca.js";

suite("opie-input", () => {
  before(() => {
    setDOM();
  });

  after(() => {
    mock.restoreAll();
    unsetDOM();
  });

  test("can instantiate component and trigger createNew on submit", async () => {
    const controller = makeTestController().controller;
    const services = makeTestServices().services;
    const env = createMockEnvironment(defaultRuntimeFlags);

    const mockCreateNew = mock.fn(async (_intent?: string) => {
      return {
        success: true,
        url: new URL("https://drive.google.com/file/d/test-id"),
      };
    });

    const mockSca = {
      controller,
      services,
      env,
      actions: {
        opie: {
          createNew: mockCreateNew,
        },
      },
    } as unknown as SCA;

    // Instantiate element class directly
    const element = new OpieInput();
    element.sca = mockSca;
    element.editable = true;

    // Mock the expanding textarea ref using any/unknown cast since it is private
    const mockTextarea = {
      value: "Create a snake game",
    };

    // Set private field using bracket notation
    (element as unknown as Record<string, unknown>)["descriptionInput"] = {
      value: mockTextarea,
    };

    // Invoke submit directly
    await element.submit();

    // Verify createNew action is called with the correct description
    assert.strictEqual(mockCreateNew.mock.callCount(), 1);
    assert.strictEqual(
      mockCreateNew.mock.calls[0].arguments[0],
      "Create a snake game"
    );
  });
});
