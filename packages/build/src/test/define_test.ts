/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */

import assert from "node:assert/strict";
import { test } from "node:test";
import { defineNodeType } from "../internal/define/define.js";
import { object } from "../internal/type-system/object.js";
import { array } from "../internal/type-system/array.js";
import { input } from "../internal/board/input.js";
import type { OutputPort } from "../internal/common/port.js";
import type { BreadboardError } from "../internal/common/error.js";

test("mono/mono", async () => {
  const values = { si1: "foo", si2: 123 };

  // $ExpectType Definition<{ si1: string; si2: number; }, { so1: boolean; so2: null; }, undefined, undefined, never, false, false, false, { si1: { board: false; }; si2: { board: false; }; }>
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      si2: { type: "number" },
    },
    outputs: {
      so1: { type: "boolean" },
      so2: { type: "null" },
    },
    invoke: (
      // $ExpectType { si1: string; si2: number; }
      staticInputs,
      // $ExpectType {}
      dynamicInputs
    ) => {
      assert.deepEqual(staticInputs, values);
      assert.deepEqual(dynamicInputs, {});
      return { so1: true, so2: null };
    },
  });

  // $ExpectType Instance<{ si1: string; si2: number; }, { so1: boolean; so2: null; }, undefined, false, false, false>
  const i = d(values);

  assert.ok(
    // $ExpectType { si1: InputPort<string>; si2: InputPort<number>; }
    i.inputs
  );
  assert.ok(
    // $ExpectType InputPort<string>
    i.inputs.si1
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.si2
  );
  assert.equal(
    // @ts-expect-error
    i.inputs.di1,
    undefined
  );

  assert.ok(
    i.outputs satisfies {
      so1: OutputPort<boolean>;
      so2: OutputPort<null>;
      $error: OutputPort<BreadboardError>;
    }
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.outputs.so1
  );
  assert.ok(
    // $ExpectType OutputPort<null>
    i.outputs.so2
  );
  assert.equal(
    // @ts-expect-error
    i.outputs.do1,
    undefined
  );

  assert.equal(
    // $ExpectType undefined
    i.primaryInput,
    undefined
  );
  assert.equal(
    // $ExpectType undefined
    i.primaryOutput,
    undefined
  );

  assert.deepEqual(await d.invoke(values, null as never), {
    so1: true,
    so2: null,
  });

  const expectedSchema = {
    inputSchema: {
      type: "object",
      properties: {
        si1: {
          title: "si1",
          type: "string",
        },
        si2: {
          title: "si2",
          type: "number",
        },
      },
      required: ["si1", "si2"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "boolean",
        },
        so2: {
          title: "so2",
          type: "null",
        },
      },
      required: [],
      additionalProperties: false,
    },
  };
  assert.deepEqual(await d.describe(), expectedSchema);
  assert.deepEqual(await d.describe(values), expectedSchema);
});

test("poly/mono", async () => {
  const values = { si1: "si1", di1: 1, di2: 2 };

  // $ExpectType Definition<{ si1: string; }, { so1: boolean; }, number, undefined, never, false, false, false, { si1: { board: false; }; }>
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      "*": { type: "number" },
    },
    outputs: {
      so1: { type: "boolean" },
    },
    describe: (
      // $ExpectType { si1: string | undefined; }
      staticInputs,
      // $ExpectType { [x: string]: number; }
      dynamicInputs
    ) => ({
      inputs: Object.keys(dynamicInputs),
    }),
    invoke: (
      // $ExpectType { si1: string; }
      staticInputs,
      // $ExpectType { [x: string]: number; }
      dynamicInputs
    ) => {
      assert.deepEqual(staticInputs, { si1: "si1" });
      assert.deepEqual(dynamicInputs, { di1: 1, di2: 2 });
      return { so1: true };
    },
  });

  // $ExpectType Instance<{ si1: string; di1: number; di2: number; }, { so1: boolean; }, undefined, false, false, false>
  const i = d(values);

  assert.ok(
    // $ExpectType { si1: InputPort<string>; di1: InputPort<number>; di2: InputPort<number>; }
    i.inputs
  );
  assert.ok(
    // $ExpectType InputPort<string>
    i.inputs.si1
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.di1
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.di2
  );
  assert.equal(
    // @ts-expect-error
    i.inputs.di3,
    undefined
  );

  assert.ok(
    i.outputs satisfies {
      so1: OutputPort<boolean>;
      $error: OutputPort<BreadboardError>;
    }
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.outputs.so1
  );
  assert.equal(
    // @ts-expect-error
    i.outputs.do1,
    undefined
  );

  assert.equal(
    // $ExpectType undefined
    i.primaryInput,
    undefined
  );
  assert.equal(
    // $ExpectType undefined
    i.primaryOutput,
    undefined
  );

  assert.deepEqual(await d.invoke(values, null as never), {
    so1: true,
  });

  assert.deepEqual(await d.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        si1: {
          title: "si1",
          type: "string",
        },
      },
      required: ["si1"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "boolean",
        },
      },
      required: [],
      additionalProperties: false,
    },
  });

  assert.deepEqual(await d.describe(values), {
    inputSchema: {
      type: "object",
      properties: {
        si1: {
          title: "si1",
          type: "string",
        },
        di1: {
          title: "di1",
          type: "number",
        },
        di2: {
          title: "di2",
          type: "number",
        },
      },
      required: ["di1", "di2", "si1"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "boolean",
        },
      },
      required: [],
      additionalProperties: false,
    },
  });
});

test("mono/poly", async () => {
  const values = { si1: "si1" };

  // $ExpectType Definition<{ si1: string; }, { so1: boolean; }, undefined, number, never, false, false, false, { si1: { board: false; }; }>
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "boolean" },
      "*": { type: "number" },
    },
    describe: (
      // $ExpectType { si1: string | undefined; }
      staticInputs,
      // $ExpectType {}
      dynamicInputs
    ) => ({ outputs: ["do1"] }),
    invoke: (
      // $ExpectType { si1: string; }
      staticInputs,
      // $ExpectType {}
      dynamicInputs
    ) => {
      assert.deepEqual(staticInputs, values);
      assert.deepEqual(dynamicInputs, {});
      return { so1: true, do1: 123 };
    },
  });

  // $ExpectType Instance<{ si1: string; }, { so1: boolean; }, number, false, false, false>
  const i = d(values);

  assert.ok(
    // $ExpectType { si1: InputPort<string>; }
    i.inputs
  );
  assert.ok(
    // $ExpectType InputPort<string>
    i.inputs.si1
  );
  assert.equal(
    // @ts-expect-error
    i.inputs.di1,
    undefined
  );

  assert.ok(
    i.outputs satisfies {
      so1: OutputPort<boolean>;
      $error: OutputPort<BreadboardError>;
    }
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.outputs.so1
  );
  // @ts-expect-error
  i.outputs.do1;

  // $ExpectType undefined
  i.primaryInput;
  // $ExpectType undefined
  i.primaryOutput;

  assert.deepEqual(await d.invoke(values, null as never), {
    so1: true,
    do1: 123,
  });

  const expectedSchema = {
    inputSchema: {
      type: "object",
      properties: {
        si1: {
          title: "si1",
          type: "string",
        },
      },
      required: ["si1"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "boolean",
        },
        do1: {
          title: "do1",
          type: "number",
        },
      },
      required: [],
      additionalProperties: false,
    },
  };
  assert.deepEqual(await d.describe(), expectedSchema);
  assert.deepEqual(await d.describe(values), expectedSchema);
});

test("poly/poly", async () => {
  const values = { si1: "si1", di1: 1, di2: 2 };

  // $ExpectType Definition<{ si1: string; }, { so1: boolean; }, number, number, never, false, false, false, { si1: { board: false; }; }>
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      "*": { type: "number" },
    },
    outputs: {
      so1: { type: "boolean" },
      "*": { type: "number" },
    },
    describe: (
      // $ExpectType { si1: string | undefined; }
      staticInputs,
      // $ExpectType { [x: string]: number; }
      dynamicInputs
    ) => ({ outputs: ["do1"] }),
    invoke: (
      // $ExpectType { si1: string; }
      staticInputs,
      // $ExpectType { [x: string]: number; }
      dynamicInputs
    ) => {
      assert.deepEqual(staticInputs, { si1: "si1" });
      assert.deepEqual(dynamicInputs, { di1: 1, di2: 2 });
      return { so1: true, do1: 123 };
    },
  });

  // $ExpectType Instance<{ si1: string; di1: number; di2: number; }, { so1: boolean; }, number, false, false, false>
  const i = d(values);

  assert.ok(
    // $ExpectType { si1: InputPort<string>; di1: InputPort<number>; di2: InputPort<number>; }
    i.inputs
  );

  assert.ok(
    // $ExpectType InputPort<string>
    i.inputs.si1
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.di1
  );

  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.di2
  );
  assert.equal(
    // @ts-expect-error
    i.inputs.di3,
    undefined
  );

  assert.ok(
    i.outputs satisfies {
      so1: OutputPort<boolean>;
      $error: OutputPort<BreadboardError>;
    }
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.outputs.so1
  );
  assert.equal(
    // @ts-expect-error
    i.outputs.do1,
    undefined
  );

  assert.ok(
    // $ExpectType OutputPort<number>
    i.unsafeOutput("do1")
  );

  assert.equal(
    // $ExpectType undefined
    i.primaryInput,
    undefined
  );
  assert.equal(
    // $ExpectType undefined
    i.primaryOutput,
    undefined
  );

  assert.deepEqual(await d.invoke(values, null as never), {
    so1: true,
    do1: 123,
  });

  assert.deepEqual(await d.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        si1: {
          title: "si1",
          type: "string",
        },
      },
      required: ["si1"],
      additionalProperties: { type: "number" },
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "boolean",
        },
        do1: {
          title: "do1",
          type: "number",
        },
      },
      required: [],
      additionalProperties: false,
    },
  });

  assert.deepEqual(await d.describe(values), {
    inputSchema: {
      type: "object",
      properties: {
        si1: {
          title: "si1",
          type: "string",
        },
        di1: {
          title: "di1",
          type: "number",
        },
        di2: {
          title: "di2",
          type: "number",
        },
      },
      required: ["si1"],
      additionalProperties: { type: "number" },
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "boolean",
        },
        do1: {
          title: "do1",
          type: "number",
        },
      },
      required: [],
      additionalProperties: false,
    },
  });
});

test("async invoke function", async () => {
  const values = { si1: 123 };
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "number" },
    },
    outputs: {
      so1: { type: "string" },
    },
    invoke: async (staticInputs, dynamicInputs) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      assert.deepEqual(staticInputs, { si1: 123 });
      assert.deepEqual(dynamicInputs, {});
      return { so1: "foo" };
    },
  });
  assert.deepEqual(await d.invoke(values, null as never), { so1: "foo" });
});

test("reflective", async () => {
  const values = { si1: "si1", di1: 1, di2: 2 };

  // $ExpectType Definition<{ si1: string; }, { so1: boolean; }, number, string, never, true, false, false, { si1: { board: false; }; }>
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      "*": { type: "number" },
    },
    outputs: {
      so1: { type: "boolean" },
      "*": { type: "string", reflective: true },
    },
    invoke: (
      // $ExpectType { si1: string; }
      staticInputs,
      // $ExpectType { [x: string]: number; }
      dynamicInputs
    ) => {
      assert.deepEqual(staticInputs, { si1: "si1" });
      assert.deepEqual(dynamicInputs, { di1: 1, di2: 2 });
      return { so1: true };
    },
  });

  // $ExpectType Instance<{ si1: string; di1: number; di2: number; }, { so1: boolean; di1: string; di2: string; }, undefined, false, false, true>
  const i = d(values);

  assert.ok(
    // $ExpectType { si1: InputPort<string>; di1: InputPort<number>; di2: InputPort<number>; }
    i.inputs
  );
  assert.ok(
    // $ExpectType InputPort<string>
    i.inputs.si1
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.di1
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.di2
  );
  assert.equal(
    // @ts-expect-error
    i.inputs.di3,
    undefined
  );

  assert.ok(
    i.outputs satisfies {
      so1: OutputPort<boolean>;
      di1: OutputPort<string>;
      di2: OutputPort<string>;
      $error: OutputPort<BreadboardError>;
    }
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.outputs.so1
  );
  assert.ok(
    // $ExpectType OutputPort<string>
    i.outputs.di1
  );
  assert.ok(
    // $ExpectType OutputPort<string>
    i.outputs.di2
  );
  assert.equal(
    // @ts-expect-error
    i.outputs.di3,
    undefined
  );

  assert.equal(
    // $ExpectType undefined
    i.primaryInput,
    undefined
  );
  assert.equal(
    // $ExpectType undefined
    i.primaryOutput,
    undefined
  );

  assert.deepEqual(await d.invoke(values, null as never), {
    so1: true,
  });

  assert.deepEqual(await d.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        si1: { type: "string", title: "si1" },
      },
      required: ["si1"],
      additionalProperties: { type: "number" },
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: { type: "boolean", title: "so1" },
      },
      required: [],
      additionalProperties: false,
    },
  });

  assert.deepEqual(await d.describe(values), {
    inputSchema: {
      type: "object",
      properties: {
        di1: { type: "number", title: "di1" },
        di2: { type: "number", title: "di2" },
        si1: { type: "string", title: "si1" },
      },
      required: ["si1"],
      additionalProperties: { type: "number" },
    },
    outputSchema: {
      type: "object",
      properties: {
        di1: { type: "number", title: "di1" },
        di2: { type: "number", title: "di2" },
        so1: { type: "boolean", title: "so1" },
      },
      required: [],
      additionalProperties: false,
    },
  });
});

test("primary input with no other inputs", () => {
  const values = { si1: 123 };

  // $ExpectType Definition<{ si1: number; }, { so1: boolean; }, undefined, undefined, never, false, "si1", false, { si1: { board: false; }; }>
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "number", primary: true },
    },
    outputs: {
      so1: { type: "boolean" },
    },
    invoke: (
      // $ExpectType { si1: number; }
      staticInputs,
      // $ExpectType {}
      dynamicInputs
    ) => ({ so1: true }),
  });

  // $ExpectType Instance<{ si1: number; }, { so1: boolean; }, undefined, "si1", false, false>
  const i = d(values);

  assert.ok(
    // $ExpectType { si1: InputPort<number>; }
    i.inputs
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.si1
  );
  assert.equal(
    // @ts-expect-error
    i.inputs.di1,
    undefined
  );

  assert.ok(
    i.outputs satisfies {
      so1: OutputPort<boolean>;
      $error: OutputPort<BreadboardError>;
    }
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.outputs.so1
  );
  assert.equal(
    // @ts-expect-error
    i.outputs.di1,
    undefined
  );

  assert.ok(
    // $ExpectType InputPort<number>
    i.primaryInput
  );
  assert.equal(
    // $ExpectType undefined
    i.primaryOutput,
    undefined
  );
});

test("primary input with another input", () => {
  const values = { si1: 123, si2: true };

  // $ExpectType Definition<{ si1: number; si2: boolean; }, { so1: boolean; }, undefined, undefined, never, false, "si1", false, { si1: { board: false; }; si2: { board: false; }; }>
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "number", primary: true },
      si2: { type: "boolean" },
    },
    outputs: {
      so1: { type: "boolean" },
    },
    invoke: (
      // $ExpectType { si1: number; si2: boolean; }
      staticInputs,
      // $ExpectType {}
      dynamicInputs
    ) => ({ so1: true }),
  });

  // $ExpectType Instance<{ si1: number; si2: boolean; }, { so1: boolean; }, undefined, "si1", false, false>
  const i = d(values);

  assert.ok(
    // $ExpectType { si1: InputPort<number>; si2: InputPort<boolean>; }
    i.inputs
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.si1
  );
  assert.equal(
    // @ts-expect-error
    i.inputs.di1,
    undefined
  );

  assert.ok(
    i.outputs satisfies {
      so1: OutputPort<boolean>;
      $error: OutputPort<BreadboardError>;
    }
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.outputs.so1
  );
  assert.equal(
    // @ts-expect-error
    i.outputs.di1,
    undefined
  );

  assert.ok(
    // $ExpectType InputPort<number>
    i.primaryInput
  );
  assert.equal(
    // $ExpectType undefined
    i.primaryOutput,
    undefined
  );
});

test("primary output with no other outputs", () => {
  // $ExpectType Definition<{ si1: number; }, { so1: boolean; }, undefined, undefined, never, false, false, "so1", { si1: { board: false; }; }>
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "number" },
    },
    outputs: {
      so1: { type: "boolean", primary: true },
    },
    invoke: (
      // $ExpectType { si1: number; }
      staticInputs,
      // $ExpectType {}
      dynamicInputs
    ) => ({ so1: true }),
  });

  // $ExpectType Instance<{ si1: number; }, { so1: boolean; }, undefined, false, "so1", false>
  const i = d({ si1: 123 });

  assert.ok(
    // $ExpectType { si1: InputPort<number>; }
    i.inputs
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.si1
  );
  assert.equal(
    // @ts-expect-error
    i.inputs.di1,
    undefined
  );

  assert.ok(
    i.outputs satisfies {
      so1: OutputPort<boolean>;
      $error: OutputPort<BreadboardError>;
    }
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.outputs.so1
  );
  assert.equal(
    // @ts-expect-error
    i.outputs.di1,
    undefined
  );

  assert.equal(
    // $ExpectType undefined
    i.primaryInput,
    undefined
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.primaryOutput
  );
});

test("primary output with other outputs", () => {
  // $ExpectType Definition<{ si1: number; }, { so1: boolean; so2: number; }, undefined, undefined, never, false, false, "so1", { si1: { board: false; }; }>
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "number" },
    },
    outputs: {
      so1: { type: "boolean", primary: true },
      so2: { type: "number" },
    },
    invoke: (
      // $ExpectType { si1: number; }
      staticInputs,
      // $ExpectType {}
      dynamicInputs
    ) => ({ so1: true, so2: 123 }),
  });

  // $ExpectType Instance<{ si1: number; }, { so1: boolean; so2: number; }, undefined, false, "so1", false>
  const i = d({ si1: 123 });

  assert.ok(
    // $ExpectType { si1: InputPort<number>; }
    i.inputs
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.si1
  );
  assert.equal(
    // @ts-expect-error
    i.inputs.di1,
    undefined
  );

  assert.ok(
    i.outputs satisfies {
      so1: OutputPort<boolean>;
      so2: OutputPort<number>;
      $error: OutputPort<BreadboardError>;
    }
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.outputs.so1
  );
  assert.equal(
    // @ts-expect-error
    i.outputs.di1,
    undefined
  );

  assert.equal(
    // $ExpectType undefined
    i.primaryInput,
    undefined
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.primaryOutput
  );
});

test("primary input + output", () => {
  // $ExpectType Definition<{ si1: number; }, { so1: boolean; }, undefined, undefined, never, false, "si1", "so1", { si1: { board: false; }; }>
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "number", primary: true },
    },
    outputs: {
      so1: { type: "boolean", primary: true },
    },
    invoke: (
      // $ExpectType { si1: number; }
      staticInputs,
      // $ExpectType {}
      dynamicInputs
    ) => ({ so1: true }),
  });

  // $ExpectType Instance<{ si1: number; }, { so1: boolean; }, undefined, "si1", "so1", false>
  const i = d({ si1: 123 });

  assert.ok(
    // $ExpectType { si1: InputPort<number>; }
    i.inputs
  );
  assert.ok(
    // $ExpectType InputPort<number>
    i.inputs.si1
  );
  assert.equal(
    // @ts-expect-error
    i.inputs.di1,
    undefined
  );

  assert.ok(
    i.outputs satisfies {
      so1: OutputPort<boolean>;
      $error: OutputPort<BreadboardError>;
    }
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.outputs.so1
  );
  assert.equal(
    // @ts-expect-error
    i.outputs.di1,
    undefined
  );

  assert.ok(
    // $ExpectType InputPort<number>
    i.primaryInput
  );
  assert.ok(
    // $ExpectType OutputPort<boolean>
    i.primaryOutput
  );
});

test("multiline/javascript", async () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: {
        type: "string",
        format: "multiline",
      },
      si2: {
        type: "string",
        format: "javascript",
      },
    },
    outputs: {
      so1: {
        type: "string",
        format: "multiline",
      },
      so2: {
        type: "string",
        format: "javascript",
      },
    },
    invoke: () => {
      return { so1: "foo", so2: "foo" };
    },
  });

  assert.deepEqual(await d.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        si1: {
          title: "si1",
          type: "string",
          format: "multiline",
        },
        si2: {
          title: "si2",
          type: "string",
          format: "javascript",
        },
      },
      required: ["si1", "si2"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "string",
          format: "multiline",
        },
        so2: {
          title: "so2",
          type: "string",
          format: "javascript",
        },
      },
      required: [],
      additionalProperties: false,
    },
  });
});

test("behavior", async () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: {
        type: "string",
        behavior: ["config"],
      },
    },
    outputs: {
      so1: {
        type: "string",
        behavior: ["image", "code"],
      },
    },
    invoke: () => {
      return { so1: "foo" };
    },
  });

  assert.deepEqual(await d.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        si1: {
          title: "si1",
          type: "string",
          behavior: ["config"],
        },
      },
      required: ["si1"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "string",
          behavior: ["image", "code"],
        },
      },
      required: [],
      additionalProperties: false,
    },
  });
});

test("dynamic port descriptions", async () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      "*": { type: "string" },
    },
    outputs: {
      "*": { type: "string" },
    },
    describe: (_, inputs) => ({
      inputs: Object.fromEntries(
        Object.keys(inputs).map((name) => [
          name,
          { description: `input "${name}"` },
        ])
      ),
      outputs: Object.fromEntries(
        Object.keys(inputs).map((name) => [
          name,
          { description: `output "${name}"` },
        ])
      ),
    }),
    invoke: () => ({}),
  });

  assert.deepEqual(await d.describe({ foo: "foo" }), {
    inputSchema: {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
          description: 'input "foo"',
        },
      },
      required: ["foo"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
          description: 'output "foo"',
        },
      },
      required: [],
      additionalProperties: false,
    },
  });
});

test("defaults", async () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      a: {
        type: "string",
        default: "foo",
      },
      b: {
        type: array("number"),
        default: [12, 34],
      },
    },
    outputs: {
      a: {
        type: "string",
      },
      b: {
        type: array("number"),
      },
    },
    invoke: (staticInputs) => staticInputs,
  });

  d({});
  d({ a: "bar" });
  d({ b: [56, 78] });
  d({ a: "bar", b: [56, 78] });

  assert.deepEqual(await d.invoke({}, null as never), {
    a: "foo",
    b: [12, 34],
  });

  assert.deepEqual(
    await d.invoke(
      {
        a: "bar",
        b: [56, 78],
      },
      null as never
    ),
    {
      a: "bar",
      b: [56, 78],
    }
  );

  const expectedSchema = {
    inputSchema: {
      type: "object",
      properties: {
        a: {
          title: "a",
          type: "string",
          default: "foo",
        },
        b: {
          title: "b",
          type: "array",
          items: { type: "number" },
          default: [12, 34],
        },
      },
      required: [],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        a: {
          title: "a",
          type: "string",
        },
        b: {
          title: "b",
          type: "array",
          items: { type: "number" },
        },
      },
      required: [],
      additionalProperties: false,
    },
  };
  assert.deepEqual(await d.describe(), expectedSchema);
  assert.deepEqual(await d.describe({ si1: "bar", si2: 123 }), expectedSchema);
});

test("optional", async () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      a: {
        type: "string",
      },
      b: {
        type: array("number"),
        optional: true,
      },
    },
    outputs: {
      serializedStaticInputs: {
        type: "string",
      },
    },
    invoke: (
      // $ExpectType { a: string; b: number[] | undefined; }
      staticInputs
    ) => ({
      serializedStaticInputs: JSON.stringify(staticInputs),
    }),
  });

  d({ a: "foo" });
  d({ a: "foo", b: [1, 2] });

  assert.throws(() =>
    d(
      // @ts-expect-error
      {}
    )
  );
  assert.throws(() =>
    d(
      // @ts-expect-error
      { b: [1, 2] }
    )
  );

  assert.deepEqual(await d.invoke({ a: "foo" }, null as never), {
    serializedStaticInputs: JSON.stringify({ a: "foo" }),
  });

  assert.deepEqual(await d.invoke({ a: "foo", b: [1, 2] }, null as never), {
    serializedStaticInputs: JSON.stringify({ a: "foo", b: [1, 2] }),
  });

  const expectedSchema = {
    inputSchema: {
      type: "object",
      properties: {
        a: {
          title: "a",
          type: "string",
        },
        b: {
          title: "b",
          type: "array",
          items: { type: "number" },
        },
      },
      additionalProperties: false,
      required: ["a"],
    },
    outputSchema: {
      type: "object",
      properties: {
        serializedStaticInputs: {
          title: "serializedStaticInputs",
          type: "string",
        },
      },
      additionalProperties: false,
      required: [],
    },
  };
  assert.deepEqual(await d.describe(), expectedSchema);
  assert.deepEqual(await d.describe({ a: "foo", b: [1, 2] }), expectedSchema);
});

test("override title", async () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string", title: "custom1" },
      si2: { type: "number" },
    },
    outputs: {
      so1: { type: "boolean" },
      so2: { type: "null", title: "custom2" },
    },
    invoke: () => ({
      so1: true,
      so2: null,
    }),
  });
  assert.deepEqual(await d.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        si1: {
          title: "custom1",
          type: "string",
        },
        si2: {
          title: "si2",
          type: "number",
        },
      },
      required: ["si1", "si2"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "boolean",
        },
        so2: {
          title: "custom2",
          type: "null",
        },
      },
      required: [],
      additionalProperties: false,
    },
  });
});

test("error: missing name", () => {
  assert.throws(
    () =>
      defineNodeType(
        // @ts-expect-error
        {
          inputs: {
            si1: { type: "string" },
          },
          outputs: {
            so1: { type: "boolean" },
          },
          invoke: () => ({ so1: true }),
        }
      ),
    /params.name is required/
  );
});

test("error: missing inputs", () => {
  assert.throws(
    () =>
      defineNodeType(
        // @ts-expect-error
        {
          name: "foo",
          outputs: {
            so1: { type: "boolean" },
          },
          invoke: () => ({ so1: true }),
        }
      ),
    /params.inputs is required/
  );
});

test("error: missing outputs", () => {
  assert.throws(
    () =>
      defineNodeType(
        // @ts-expect-error
        {
          name: "foo",
          inputs: {
            si1: { type: "string" },
          },
          invoke: () => ({}),
        }
      ),
    /params.outputs is required/
  );
});

test("error: missing invoke", () => {
  assert.throws(
    () =>
      defineNodeType(
        // @ts-expect-error
        {
          name: "foo",
          inputs: {
            si1: { type: "string" },
          },
          outputs: {
            so1: { type: "boolean" },
          },
        }
      ),
    /params.invoke is required/
  );
});

test("error: invalid input type", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      si2: {
        // @ts-expect-error
        type: "foo",
      },
    },
    outputs: {
      so1: { type: "boolean" },
    },
    invoke: () => ({ so1: true }),
  });
});

test("error: invalid output type", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "boolean" },
      so2: {
        // @ts-expect-error
        type: "foo",
      },
    },
    invoke: () => ({ so1: true }),
  });
});

test("error: unexpected input property", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: {
        type: "string",
        // @ts-expect-error
        bad: true,
      },
    },
    outputs: {
      so1: { type: "boolean" },
    },
    invoke: () => ({ so1: true }),
  });
});

test("error: unexpected output property", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: {
        type: "boolean",
        // @ts-expect-error
        bad: true,
      },
    },
    invoke: () => ({ so1: true }),
  });
});

test("error: invoke missing output", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: {
        type: "boolean",
      },
      so2: {
        type: "number",
      },
    },
    // @ts-expect-error
    invoke: () => ({
      so1: true,
    }),
  });
});

test("error: invoke returns wrong static type", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: {
        type: "boolean",
      },
    },
    // @ts-expect-error
    invoke: () => ({
      so1: 0,
    }),
  });
});

test("error: static invoke returns excess property", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "boolean" },
    },
    // @ts-expect-error
    invoke: () => ({
      so1: true,
      do1: "foo",
    }),
  });
});

test("error: invoke returns wrong dynamic type", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "boolean" },
      "*": { type: "number" },
    },
    // @ts-expect-error
    invoke: () => ({
      so1: true,
      do1: "foo",
    }),
  });
});

test("error: primary on dynamic input", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      "*": {
        type: "number",
        // @ts-expect-error
        primary: true,
      },
    },
    outputs: {
      so1: { type: "boolean" },
    },
    invoke: () => ({ so1: true }),
  });
});

test("error: primary on dynamic output", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "boolean" },
      "*": {
        type: "number",
        // @ts-expect-error
        primary: true,
      },
    },
    invoke: () => ({ so1: true }),
  });
});

test("error: multiple primary inputs", () => {
  assert.throws(
    () =>
      defineNodeType({
        name: "foo",
        inputs: {
          si1: {
            type: "string",
            // @ts-expect-error
            primary: true,
          },
          si2: {
            type: "string",
            // @ts-expect-error
            primary: true,
          },
        },
        outputs: {
          so1: { type: "boolean" },
        },
        invoke: () => ({ so1: true }),
      }),
    /Too many primaries/
  );
});

test("error: multiple primary outputs", () => {
  assert.throws(
    () =>
      defineNodeType({
        name: "foo",
        inputs: {
          si1: { type: "string" },
        },
        outputs: {
          so1: {
            type: "boolean",
            // @ts-expect-error
            primary: true,
          },
          so2: {
            type: "boolean",
            // @ts-expect-error
            primary: true,
          },
        },
        invoke: () => ({ so1: true, so2: false }),
      }),
    /Too many primaries/
  );
});

test("error: reflective on input", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: {
        type: "string",
        // @ts-expect-error
        reflective: true,
      },
    },
    outputs: {
      so1: { type: "boolean" },
    },
    invoke: () => ({ so1: true }),
  });
});

test("error: reflective on static output", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: {
        type: "boolean",
        // @ts-expect-error
        reflective: true,
      },
    },
    invoke: () => ({ so1: true }),
  });
});

test("error: no instantiate inputs", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {},
    invoke: () => ({}),
  });
  assert.throws(
    () =>
      // @ts-expect-error
      d(),
    /args is required/
  );
});

test("error: missing instantiate input", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {},
    invoke: () => ({}),
  });
  assert.throws(
    () =>
      d(
        // @ts-expect-error
        {}
      ),
    /si1 is required/
  );
});

test("error: wrong instantiate static input type", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {},
    invoke: () => ({}),
  });
  d({
    // @ts-expect-error
    si1: 123,
  });
});

test("error: wrong instantiate dynamic input type", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      "*": { type: "string" },
    },
    outputs: {},
    invoke: () => ({}),
  });
  d({
    si1: "foo",
    // @ts-expect-error
    di1: 123,
  });
});

test("error: excess instantiate input", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {},
    invoke: () => ({}),
  });
  assert.throws(
    () =>
      d({
        si1: "foo",
        // @ts-expect-error
        si2: 123,
      }),
    /Unexpected input: si2/
  );
});

test("error: mono/poly should not return inputs", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
      "*": { type: "string", reflective: true },
    },
    // @ts-expect-error
    describe: () => ({ inputs: [], outputs: [] }),
    invoke: () => ({ so1: "so1" }),
  });
});

test("error: poly/mono should not return outputs", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      "*": { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
    },
    // @ts-expect-error
    describe: () => ({ inputs: [], outputs: [] }),
    invoke: () => ({ so1: "so1" }),
  });
});

test("error: reflective poly/poly should not return outputs", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      "*": { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
      "*": { type: "string", reflective: true },
    },
    // @ts-expect-error
    describe: () => ({ inputs: [], outputs: [] }),
    invoke: () => ({ so1: "so1" }),
  });
});

test("error: unsafeOutput with entirely static outputs", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {
      so1: { type: "string" },
    },
    invoke: () => ({ so1: "so1" }),
  });
  const i = d({});
  assert.throws(
    () =>
      // @ts-expect-error
      i.unsafeOutput("do1"),
    /unsafeOutput was called unnecessarily on a BreadboardNode. Type "foo" has entirely static outputs. Use "<node>.outputs.do1" instead./
  );
});

test("error: unsafeOutput on reflective node", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      "*": { type: "number" },
    },
    outputs: {
      so1: { type: "string" },
      "*": { type: "number", reflective: true },
    },
    invoke: () => ({ so1: "so1" }),
  });
  const i = d({});
  assert.throws(
    () =>
      // @ts-expect-error
      i.unsafeOutput("do1"),
    /unsafeOutput was called unnecessarily on a BreadboardNode. Type "foo" is reflective. Use "<node>.outputs.do1" instead./
  );
});

test("error: unsafeOutput on existing static output", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {
      so1: { type: "string" },
      "*": { type: "number" },
    },
    describe: () => ({ outputs: ["foo"] }),
    invoke: () => ({ so1: "so1" }),
  });
  const i = d({});
  assert.throws(
    () =>
      i.unsafeOutput(
        // @ts-expect-error
        "so1"
      ),
    /unsafeOutput was called unnecessarily on a BreadboardNode. Type "foo" already has a static port called "so1". Use "<node>.outputs.so1" instead./
  );
});

test("error: object types must be plain objects at initialization", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      "*": { type: object({}) },
    },
    outputs: {},
    invoke: () => ({}),
  });
  const i = d({
    ok1: {},
    ok2: { foo: 123 },

    // @ts-expect-error
    bad1: 123,
    // @ts-expect-error
    bad1: "foo",
    // @ts-expect-error
    bad1: globalThis,
    // @ts-expect-error
    bad1: Object,
  });
});

test("error: default on dynamic input/output or static output", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      "*": {
        type: "string",
        // @ts-expect-error
        default: "foo",
      },
    },
    outputs: {
      so1: {
        type: "string",
        // @ts-expect-error
        default: "foo",
      },
      "*": {
        type: "string",
        // @ts-expect-error
        default: "foo",
      },
    },
    describe: () => ({ outputs: [] }),
    invoke: () => ({ so1: "foo" }),
  });
});

test("error: default does not match type", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: {
        type: "string",
        // @ts-expect-error
        default: 123,
      },
    },
    outputs: {},
    invoke: () => ({}),
  });
});

test("error: can't set optional when there is a default", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: {
        type: "string",
        default: "foo",
        // @ts-expect-error
        optional: true,
      },
    },
    outputs: {},
    invoke: () => ({}),
  });
});

test("error: input port can't be called $id", () => {
  assert.throws(() => {
    const def = defineNodeType({
      name: "foo",
      inputs: {
        // @ts-expect-error
        $id: { type: "string" },
      },
      outputs: {},
      invoke: () => ({}),
    });
    def({});
  }, /"\$id" cannot be used as an input port name because it is reserved/);
});

test("error: $id must only be a string, not an output port", () => {
  const d1 = defineNodeType({
    name: "d1",
    inputs: {},
    outputs: {
      foo: { type: "string", primary: true },
    },
    invoke: () => ({ foo: "foo" }),
  });
  const i1 = d1({});

  const d2 = defineNodeType({
    name: "d2",
    inputs: {},
    outputs: {},
    invoke: () => ({}),
  });

  d2({ $id: "foo" });
  d2({
    // @ts-expect-error
    $id: i1.outputs.foo,
  });
  d2({
    // @ts-expect-error
    $id: input(),
  });
});

test("$id should not show up as an instance input", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {},
    invoke: () => ({}),
  });
  const i = d({ $id: "foo" });
  // $ExpectType {}
  i.inputs;
  // $ExpectType { $error: OutputPort<{ message: string; } | { kind: string; error: { message: string; }; }>; }
  i.outputs;
  assert.equal(
    // @ts-expect-error
    i.inputs.$id,
    undefined
  );
});

test("$id should not show up as a reflective output", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      "*": {
        type: "string",
      },
    },
    outputs: {
      "*": {
        type: "string",
        reflective: true,
      },
    },
    describe: () => ({ inputs: {} }),
    invoke: () => ({}),
  });
  const i = d({ $id: "foo", notId: "foo" });
  // $ExpectType { notId: InputPort<string>; }
  i.inputs;
  i.outputs satisfies {
    notId: OutputPort<string>;
    $error: OutputPort<BreadboardError>;
  };
  assert.equal(
    // @ts-expect-error
    i.outputs.$id,
    undefined
  );
  assert.ok(i.outputs.notId);
});
