/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { board, inputNode, outputNode } from "../internal/board/board.js";
import { converge, type Convergence } from "../internal/board/converge.js";
import {
  input,
  type Input,
  type InputWithDefault,
} from "../internal/board/input.js";
import { loopback, type Loopback } from "../internal/board/loopback.js";
import { output, type Output } from "../internal/board/output.js";
import type {
  OutputPort,
  OutputPortReference,
} from "../internal/common/port.js";
import type { Value } from "../internal/common/value.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */

// TODO(aomarks) board definitions that take boards (we have this working for
// discrete component, but not boards).

describe("input types", () => {
  test("required", () => {
    const foo = input();
    // $ExpectType BoardDefinition<{ foo: string; }, {}>
    board({ inputs: { foo }, outputs: {} });
  });

  test("optional", () => {
    const foo = input({ optional: true });
    // $ExpectType BoardDefinition<{ foo?: string | undefined; }, {}>
    board({ inputs: { foo }, outputs: {} });
  });

  test("with default", () => {
    const foo = input({ default: "foo" });
    // $ExpectType BoardDefinition<{ foo?: string | undefined; }, {}>
    board({ inputs: { foo }, outputs: {} });
  });

  test("multiple", () => {
    const foo = input();
    const bar = input({ type: "number" });
    const baz = input({ type: "boolean", default: true });
    const qux = input({ optional: true });

    // $ExpectType BoardDefinition<{ foo: string; }, {}>
    board({ inputs: [inputNode({ foo })], outputs: {} });

    // $ExpectType BoardDefinition<{ foo: string; } | { bar: number; }, {}>
    board({ inputs: [inputNode({ foo }), inputNode({ bar })], outputs: {} });

    // $ExpectType BoardDefinition<{ foo: string; bar: number; } | { bar: number; }, {}>
    board({
      inputs: [inputNode({ foo, bar }), inputNode({ bar })],
      outputs: {},
    });

    // $ExpectType BoardDefinition<{ baz?: boolean | undefined; }, {}>
    board({ inputs: [inputNode({ baz })], outputs: {} });

    // $ExpectType BoardDefinition<{ qux?: string | undefined; }, {}>
    board({ inputs: [inputNode({ qux })], outputs: {} });
  });
});

describe("output types", () => {
  test("output port", () => {
    const foo = {} as OutputPort<string>;
    // $ExpectType BoardDefinition<{}, { foo: string; }>
    board({ inputs: {}, outputs: { foo } });
  });

  test("output port reference", () => {
    const foo = {} as OutputPortReference<string>;
    // $ExpectType BoardDefinition<{}, { foo: string; }>
    board({ inputs: {}, outputs: { foo } });
  });

  test("input", () => {
    const foo = input();
    // $ExpectType BoardDefinition<{}, { foo: string; }>
    board({ inputs: {}, outputs: { foo } });
  });

  test("optional input", () => {
    const foo = input({ optional: true });
    // $ExpectType BoardDefinition<{}, { foo?: string | undefined; }>
    board({ inputs: {}, outputs: { foo } });
  });

  test("input with default", () => {
    const foo = input({ optional: true });
    // $ExpectType BoardDefinition<{}, { foo?: string | undefined; }>
    board({ inputs: {}, outputs: { foo } });
  });

  test("loopback", () => {
    const foo = loopback();
    // $ExpectType BoardDefinition<{}, { foo: string; }>
    board({ inputs: {}, outputs: { foo } });
  });

  test("convergence", () => {
    const foo = converge(input(), input());
    // $ExpectType BoardDefinition<{}, { foo: string; }>
    board({ inputs: {}, outputs: { foo } });
  });

  test("multiple", () => {
    const foo = input();
    const bar = input({ type: "number" });
    const baz = input({ type: "boolean", default: true });
    const qux = input({ optional: true });

    // $ExpectType BoardDefinition<{}, { foo: string; }>
    board({ inputs: {}, outputs: [outputNode({ foo })] });

    // $ExpectType BoardDefinition<{}, { baz?: boolean | undefined; }>
    board({ inputs: {}, outputs: [outputNode({ baz })] });

    // $ExpectType BoardDefinition<{}, { qux?: string | undefined; }>
    board({ inputs: {}, outputs: [outputNode({ qux })] });

    // $ExpectType BoardDefinition<{}, { foo: string; bar: number; } | { foo: string; }>
    const b = board({
      inputs: {},
      outputs: [outputNode({ foo, bar }), outputNode({ foo })],
    });

    // $ExpectType { foo: Value<string>; bar: Value<number | undefined>; }
    b({}).outputs;

    // $ExpectType BoardDefinition<{}, { baz?: boolean | undefined; }>
    board({ inputs: {}, outputs: [outputNode({ baz })] });

    // $ExpectType BoardDefinition<{}, { qux?: string | undefined; }>
    board({ inputs: {}, outputs: [outputNode({ qux })] });
  });
});

describe("instantiate function", () => {
  describe("monomorphic", () => {
    const foo = input();
    const bar = input({ type: "number", optional: true });
    // $ExpectType BoardDefinition<{ bar?: number | undefined; foo: string; }, { bar?: number | undefined; foo: string; }>
    const b = board({ inputs: { foo, bar }, outputs: { foo, bar } });
    // $ExpectType { bar?: Value<number | undefined>; foo: Value<string>; } & { $id?: string | undefined; $metadata?: NodeMetadata | undefined; }
    const x = {} as Parameters<typeof b>[0];

    test("instance types", () => {
      // $ExpectType BoardInstance<{ bar?: number | undefined; foo: string; }, { bar?: number | undefined; foo: string; }>
      const inst = b({ foo: "foo", bar: 123 });

      // $ExpectType { bar?: Value<number | undefined>; foo: Value<string>; }
      inst.outputs;
    });

    test("required values", () => {
      b({ foo: "foo" });
      b(
        // @ts-expect-error
        { bar: 123 }
      );
      // @ts-expect-error
      b();
      b(
        // @ts-expect-error
        {}
      );
    });

    test("raw value", () => {
      b({
        foo: "foo",
        bar: 123,
      });

      b({
        // @ts-expect-error
        foo: 123,
        // @ts-expect-error
        bar: "bar",
      });
    });

    test("output port", () => {
      b({
        foo: {} as OutputPort<string>,
        bar: {} as OutputPort<number>,
      });

      b({
        // @ts-expect-error
        foo: {} as OutputPort<number>,
        // @ts-expect-error
        bar: {} as OutputPort<string>,
      });
    });

    test("output port reference", () => {
      b({
        foo: {} as OutputPortReference<string>,
        bar: {} as OutputPortReference<number>,
      });

      b({
        // @ts-expect-error
        foo: {} as OutputPortReference<number>,
        // @ts-expect-error
        bar: {} as OutputPortReference<string>,
      });
    });

    test("input", () => {
      b({
        foo: input(),
        bar: input({ type: "number" }),
      });

      b({
        // @ts-expect-error
        foo: input({ type: "number" }),
        // @ts-expect-error
        bar: input(),
      });
    });

    test("optional input", () => {
      b({
        // @ts-expect-error
        foo: input({ optional: true }),
        bar: input({ type: "number", optional: true }),
      });
    });

    test("input with default", () => {
      b({
        foo: input({ default: "foo" }),
        bar: input({ type: "number", default: 123 }),
      });
    });

    test("loopback", () => {
      b({
        foo: loopback(),
        bar: loopback({ type: "number" }),
      });

      b({
        // @ts-expect-error
        foo: loopback({ type: "number" }),
        // @ts-expect-error
        bar: loopback(),
      });
    });

    test("convergence", () => {
      b({
        foo: converge(input(), input()),
        bar: converge(input({ type: "number" }), input({ type: "number" })),
      });
      b({
        // @ts-expect-error
        foo: converge(input({ type: "number" }), input({ type: "number" })),
        // @ts-expect-error
        bar: converge(input(), input()),
      });
    });
  });

  test("polymorphic", () => {
    const foo = input();
    const bar = input({ type: "number" });
    // $ExpectType BoardDefinition<{ foo: string; } | { bar: number; }, {}>
    const b = board({
      inputs: [inputNode({ foo }), inputNode({ bar })],
      outputs: {},
    });
    // $ExpectType ({ foo: Value<string>; } | { bar: Value<number>; }) & { $id?: string | undefined; $metadata?: NodeMetadata | undefined; }
    const x = {} as Parameters<typeof b>[0];

    test("instantiate function types", () => {
      // @ts-expect-error
      b();
      b(
        // @ts-expect-error
        {}
      );
      b({ foo: "foo" });
      b({ bar: 123 });
      b({
        foo: "foo",
        // @ts-expect-error
        xxx: 123,
      });
      b({
        // @ts-expect-error
        foo: 123,
      });
      b({
        // @ts-expect-error
        bar: "bar",
      });
    });
  });
});

test("board metadata", () => {
  const foo = input();
  // $ExpectType BoardDefinition<{ foo: string; }, {}>
  board({
    id: "my-id",
    title: "My Title",
    description: "My Description",
    version: "1.0.0",
    metadata: {},

    inputs: { foo },
    outputs: {},
  });
});

test("one input node metadata", () => {
  const foo = input();
  // $ExpectType BoardDefinition<{ foo: string; }, {}>
  board({
    inputs: inputNode(
      { foo },
      {
        id: "input-node-id",
        description: "Input Node Description",
      }
    ),
    outputs: {},
  });
});

test("one output node metadata", () => {
  const foo = input({ type: "boolean" });
  // $ExpectType BoardDefinition<{}, { foo: boolean; }>
  board({
    inputs: {},
    outputs: outputNode(
      { foo },
      {
        id: "output-node-id",
        description: "Output Node Description",
      }
    ),
  });
});

test("output port metadata", () => {
  const foo = input();
  const bar = input({ type: "number" });
  // $ExpectType BoardDefinition<{}, { foo: string; bar: number; }>
  board({
    inputs: {},
    outputs: {
      foo: output(foo, {
        id: "foo-port-id",
        description: "Foo Port Description",
      }),
      bar: output(bar, {
        id: "bar-port-id",
        description: "Bar Port Description",
      }),
    },
  });
});

describe("exotic output types", () => {
  // $ExpectType BoardDefinition<{}, { foo: number | boolean; }>
  board({
    inputs: {},
    outputs: { foo: {} as Loopback<number | boolean> },
  });

  // $ExpectType BoardDefinition<{}, { foo: number | boolean; }>
  board({
    inputs: {},
    outputs: { foo: {} as Convergence<number | boolean> },
  });

  // $ExpectType BoardDefinition<{}, { foo: number | boolean; }>
  board({
    inputs: {},
    outputs: { foo: {} as Output<number | boolean> },
  });

  // $ExpectType BoardDefinition<{}, { foo: number | boolean; }>
  board({
    inputs: {},
    outputs: { foo: {} as OutputPort<number | boolean> },
  });

  // $ExpectType BoardDefinition<{}, { foo: number | boolean; }>
  board({
    inputs: {},
    outputs: { foo: {} as OutputPortReference<number | boolean> },
  });

  // $ExpectType BoardDefinition<{}, { foo: number | boolean; }>
  board({
    inputs: {},
    outputs: { foo: {} as Input<number | boolean> },
  });

  // $ExpectType BoardDefinition<{}, { foo?: number | boolean | undefined; }>
  board({
    inputs: {},
    outputs: { foo: {} as InputWithDefault<number | boolean> },
  });

  // $ExpectType BoardDefinition<{}, { foo: number | boolean; }>
  board({
    inputs: {},
    outputs: { foo: {} as Value<number | boolean> },
  });
});
