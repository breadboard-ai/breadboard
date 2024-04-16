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

test("mono/mono", async () => {
  // $ExpectType Definition<{ si1: string; si2: number; }, { so1: boolean; so2: null; }, undefined, undefined, false, undefined, undefined>
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
    ) => ({ so1: true, so2: null }),
  });

  const values = { si1: "foo", si2: 123 };
  // $ExpectType Instance<{ si1: string; si2: number; }, { so1: boolean; so2: null; }, undefined, undefined, undefined, false>
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
    // $ExpectType { so1: OutputPort<boolean>; so2: OutputPort<null>; }
    i.outputs
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
      required: ["so1", "so2"],
    },
  };
  assert.deepEqual(await d.describe(), expectedSchema);
  assert.deepEqual(await d.describe(values), expectedSchema);
});

test("poly/mono", async () => {
  // $ExpectType Definition<{ si1: string; }, { so1: boolean; }, number, undefined, false, undefined, undefined>
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
      // $ExpectType { si1: string; }
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
    ) => ({ so1: true }),
  });

  const values = { si1: "si1", di1: 1, di2: 2 };

  // $ExpectType Instance<{ si1: string; di1: number; di2: number; }, { so1: boolean; }, undefined, undefined, undefined, false>
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
    // $ExpectType { so1: OutputPort<boolean>; }
    i.outputs
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
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "boolean",
        },
      },
      required: ["so1"],
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
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: {
          title: "so1",
          type: "boolean",
        },
      },
      required: ["so1"],
    },
  });
});

test("mono/poly", async () => {
  // $ExpectType Definition<{ si1: string; }, { so1: boolean; }, undefined, number, false, undefined, undefined>
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
      // $ExpectType { si1: string; }
      staticInputs,
      // $ExpectType {}
      dynamicInputs
    ) => ({ outputs: ["do1"] }),
    invoke: (
      // $ExpectType { si1: string; }
      staticInputs,
      // $ExpectType {}
      dynamicInputs
    ) => ({ so1: true, do1: 123 }),
  });

  const values = { si1: "si1" };
  // $ExpectType Instance<{ si1: string; }, { so1: boolean; }, number, undefined, undefined, false>
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
    // $ExpectType { so1: OutputPort<boolean>; }
    i.outputs
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
      required: ["do1", "so1"],
    },
  };
  assert.deepEqual(await d.describe(), expectedSchema);
  assert.deepEqual(await d.describe(values), expectedSchema);
});

test("poly/poly", async () => {
  // $ExpectType Definition<{ si1: string; }, { so1: boolean; }, number, number, false, undefined, undefined>
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
      // $ExpectType { si1: string; }
      staticInputs,
      // $ExpectType { [x: string]: number; }
      dynamicInputs
    ) => ({ outputs: ["do1"] }),
    invoke: (
      // $ExpectType { si1: string; }
      staticInputs,
      // $ExpectType { [x: string]: number; }
      dynamicInputs
    ) => ({ so1: true, do1: 123 }),
  });

  const values = { si1: "si1", di1: 1, di2: 2 };
  // $ExpectType Instance<{ si1: string; di1: number; di2: number; }, { so1: boolean; }, number, undefined, undefined, false>
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
    // $ExpectType { so1: OutputPort<boolean>; }
    i.outputs
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
    i.assertOutput("do1")
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
      required: ["do1", "so1"],
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
      required: ["do1", "so1"],
    },
  });
});

test("reflective", async () => {
  // $ExpectType Definition<{ si1: string; }, { so1: boolean; }, number, string, true, undefined, undefined>
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
    ) => ({ so1: true }),
  });

  const values = { si1: "si1", di1: 1, di2: 2 };

  // $ExpectType Instance<{ si1: string; di1: number; di2: number; }, { so1: boolean; di1: string; di2: string; }, undefined, undefined, undefined, true>
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
    // $ExpectType { so1: OutputPort<boolean>; di1: OutputPort<string>; di2: OutputPort<string>; }
    i.outputs
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

  assert.deepEqual(await d.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        si1: { type: "string", title: "si1" },
      },
      required: ["si1"],
    },
    outputSchema: {
      type: "object",
      properties: {
        so1: { type: "boolean", title: "so1" },
      },
      required: ["so1"],
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
      required: ["di1", "di2", "si1"],
    },
    outputSchema: {
      type: "object",
      properties: {
        di1: { type: "string", title: "di1" },
        di2: { type: "string", title: "di2" },
        so1: { type: "boolean", title: "so1" },
      },
      required: ["di1", "di2", "so1"],
    },
  });
});

test("primary input", () => {
  // $ExpectType Definition<{ si1: number; }, { so1: boolean; }, undefined, undefined, false, "si1", undefined>
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

  // $ExpectType Instance<{ si1: number; }, { so1: boolean; }, undefined, "si1", undefined, false>
  const i = d({ si1: 123 });

  // $ExpectType { si1: InputPort<number>; }
  i.inputs;
  // $ExpectType InputPort<number>
  i.inputs.si1;
  // @ts-expect-error
  i.inputs.di1;

  // $ExpectType { so1: OutputPort<boolean>; }
  i.outputs;
  // $ExpectType OutputPort<boolean>
  i.outputs.so1;
  // @ts-expect-error
  i.outputs.di1;

  // $ExpectType InputPort<number>
  i.primaryInput;
  // $ExpectType undefined
  i.primaryOutput;
});

test("primary output", () => {
  // $ExpectType Definition<{ si1: number; }, { so1: boolean; }, undefined, undefined, false, undefined, "so1">
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

  // $ExpectType Instance<{ si1: number; }, { so1: boolean; }, undefined, undefined, "so1", false>
  const i = d({ si1: 123 });

  // $ExpectType { si1: InputPort<number>; }
  i.inputs;
  // $ExpectType InputPort<number>
  i.inputs.si1;
  // @ts-expect-error
  i.inputs.di1;

  // $ExpectType { so1: OutputPort<boolean>; }
  i.outputs;
  // $ExpectType OutputPort<boolean>
  i.outputs.so1;
  // @ts-expect-error
  i.outputs.di1;

  // $ExpectType undefined
  i.primaryInput;
  // $ExpectType OutputPort<boolean>
  i.primaryOutput;
});

test("primary input + output", () => {
  // $ExpectType Definition<{ si1: number; }, { so1: boolean; }, undefined, undefined, false, "si1", "so1">
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

  // $ExpectType { si1: InputPort<number>; }
  i.inputs;
  // $ExpectType InputPort<number>
  i.inputs.si1;
  // @ts-expect-error
  i.inputs.di1;

  // $ExpectType { so1: OutputPort<boolean>; }
  i.outputs;
  // $ExpectType OutputPort<boolean>
  i.outputs.so1;
  // @ts-expect-error
  i.outputs.di1;

  // $ExpectType InputPort<number>
  i.primaryInput;
  // $ExpectType OutputPort<boolean>
  i.primaryOutput;
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

test("error: mono/mono should not have describe", () => {
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
    },
    // @ts-expect-error
    describe: () => ({ inputs: [], outputs: [] }),
    invoke: () => ({ so1: "so1" }),
  });
});

test("error: mono/poly must have describe", () => {
  // @ts-expect-error
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
      "*": { type: "number" },
    },
    invoke: () => ({ so1: "so1" }),
  });
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

test("error: non-reflective poly/poly must have describe", () => {
  // @ts-expect-error
  const d = defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      "*": { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
      "*": { type: "string" },
    },
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

test("error: assertOutput with entirely static outputs", () => {
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
      i.assertOutput("do1"),
    /assertOutput was called unnecessarily on a BreadboardNode. Type "foo" has entirely static outputs. Use "<node>.outputs.do1" instead./
  );
});

test("error: assertOutput on reflective node", () => {
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
      i.assertOutput("do1"),
    /assertOutput was called unnecessarily on a BreadboardNode. Type "foo" is reflective. Use "<node>.outputs.do1" instead./
  );
});

test("error: assertOutput on existing static output", () => {
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
      i.assertOutput(
        // @ts-expect-error
        "so1"
      ),
    /assertOutput was called unnecessarily on a BreadboardNode. Type "foo" already has a static port called "so1". Use "<node>.outputs.so1" instead./
  );
});
