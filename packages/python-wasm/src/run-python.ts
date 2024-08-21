/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";
import { loadPyodide } from "pyodide";

export const runPython = defineNodeType({
  name: "runPython",
  inputs: {
    $code: {
      type: "string",
      description: "The Python code to run",
      format: "multiline",
    },
    "*": {
      type: "unknown",
    },
  },
  outputs: {
    "*": {
      type: "unknown",
    },
  },

  describe: () => {
    // TODO(aomarks) Allowing passing in input/output schemas so that we can
    // show the proper ports.
    return {
      inputs: { "*": "unknown" },
      outputs: { "*": "unknown" },
    };
  },

  invoke: async ({ $code }, inputs) => {
    // Load the Python WASM runtime.
    let pyodie: Awaited<ReturnType<typeof loadPyodide>>;
    try {
      pyodie = await loadPyodide();
    } catch (e) {
      return {
        $error: `Error loading pyodide: ${e} ${(e as Error).stack}`,
      };
    }

    // Invoke user code in the Python WASM runtime.
    let rawResult: unknown;
    try {
      pyodie.globals.set("inputs", inputs);
      rawResult = await pyodie.runPythonAsync($code);
    } catch (e) {
      return {
        $error: `Error executing Python: ${e} ${(e as Error).stack}`,
      };
    }

    // Convert Python proxy value to a JavaScript value using
    // https://pyodide.org/en/stable/usage/api/js-api.html#pyodide.ffi.PyProxy.toJs
    if (typeof rawResult !== "object" || rawResult === null) {
      return {
        $error:
          `Python function did not return a dict.` +
          ` Got type "${niceType(rawResult)}".` +
          ` Please return a dict with JSON serializable values.`,
      };
    }
    if (!("toJs" in rawResult)) {
      return {
        $error:
          `Python function returned an object which` +
          ` cannot be converted to a JavaScript value.` +
          ` Please return a dict with JSON serializable values.`,
      };
    }
    let jsResult: unknown;
    try {
      jsResult = (rawResult as { toJs: () => unknown }).toJs();
    } catch (e) {
      return {
        $error:
          `Error converting Python value to JavaScript value: ${e}` +
          ` Please return a dict with JSON serializable values.`,
      };
    }

    // Ensure that the JavaScript value we ended up with is a JSON-serializable
    // object, and also convert it to a plain object because the result we get
    // from toJs() will still be a special pyoide type which is not
    // structuredClone.
    let jsonSafeResult: unknown;
    try {
      jsonSafeResult = JSON.parse(JSON.stringify(jsResult));
    } catch (e) {
      return {
        $error:
          `Error serializing Python value to JSON: ${e}.` +
          ` Please return a dict with JSON serializable values.`,
      };
    }
    if (
      !(
        typeof jsonSafeResult === "object" &&
        jsonSafeResult !== null &&
        jsonSafeResult.constructor === Object
      )
    ) {
      // This handles the Array case (which would have constructor === Array
      // instead of Object), and possibly some other weird cases.
      return {
        $error:
          `Python function did not return a dict.` +
          ` Got type "${niceType(jsonSafeResult)}".` +
          ` Please return a dict with JSON serializable values.`,
      };
    }

    // Done!
    return jsonSafeResult;
  },
});

/**
 * Just `typeof`, but with a special case for `null` and `array` (which would
 * otherwise both be `"object"`).
 */
function niceType(
  value: unknown
):
  | "null"
  | "array"
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "undefined"
  | "object"
  | "function" {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}
