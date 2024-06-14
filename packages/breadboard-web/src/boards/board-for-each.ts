import {
  AbstractNode,
  base,
  board,
  code,
  InputValues,
  NodeValue,
} from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import {
  AbstractValue,
  NodeProxy,
} from "../../../breadboard/dist/src/new/grammar/types";
import { OutputValue } from "../../../breadboard/dist/src/new/runner/types";
import { pop } from "../utils/pop";

const demoBoard = await board<
  {
    item: string;
  },
  {
    item: string;
  }
>(() => {
  const input = base.input({
    $metadata: {
      title: "Input",
    },
  });

  const reverse = code<{ item: string }, { item: string }>((inputs) => {
    const { item } = inputs;
    return {
      item: item
        .split("")
        .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
        .join(""),
    };
  })(input.item);

  const output = base.output({
    $metadata: {
      title: "Output",
    },
  });
  reverse.to(output);
  return output;
}).serialize();
const input = base.input({
  $metadata: {
    title: "Input",
  },
  schema: {
    type: "object",
    properties: {
      board: {
        examples: [JSON.stringify(demoBoard)],
      },
      array: {
        type: "array",
        examples: [JSON.stringify(["The", "quick", "brown", "fox"])],
      },
    },
  },
});

const passthrough = core.passthrough({
  $metadata: {
    title: "Passthrough",
  },
  board: input.board,
});
passthrough.board.to(passthrough);

const invocation = core.invoke({
  // $board: input.board,
  item: passthrough.item,
  $board: passthrough.board,
  $metadata: {
    title: "Invoke",
  },
});

const output = base.output({
  $metadata: {
    title: "Output",
  },
});

const popItem = pop({
  $metadata: {
    title: "Pop item",
  },
  array: input.array as unknown as [],
});

popItem.array.to(popItem);
popItem.item.to(passthrough);

type AccumulatorInput<T> = {
  item: T;
  array?: T[];
};
type AccumulatorOutput<T> = {
  array: T[];
};

function accumulator<T>(
  inputs:
    | AbstractNode<InputValues, AccumulatorInput<T>>
    | AbstractValue<NodeValue>
    | Partial<{
        [K in keyof AccumulatorInput<T>]:
          | AbstractValue<AccumulatorInput<T>[K]>
          | NodeProxy<InputValues, OutputValue<AccumulatorInput<T>[K]>>
          | AccumulatorInput<T>[K];
      }>
    | {
        [p: string]:
          | AbstractValue<NodeValue>
          | NodeProxy<InputValues, Partial<InputValues>>
          | NodeValue;
      }
): NodeProxy<AccumulatorInput<T>, Required<AccumulatorOutput<T>>> {
  return code<AccumulatorInput<T>, AccumulatorOutput<T>>(
    (inputs: AccumulatorInput<T>) => {
      const { item, array = [] } = inputs;
      return { array: [...array, item] };
    }
  )(inputs);
}

const accumulate = accumulator({
  item: invocation.item,
  $metadata: {
    title: "Accumulate",
  },
});

accumulate.to(accumulate);

function emitter<T>(
  args: any
): NodeProxy<
  { a?: T[] | undefined; b?: T[] | undefined },
  Required<{ emit?: T[] | undefined }>
> {
  return code<
    { a?: T[]; b?: T[] },
    {
      emit?: T[];
    }
  >(
    (
      inputs
    ): { emit: T[] | undefined; a: T[] | undefined; b: T[] | undefined } => {
      let emit = undefined;
      if (!inputs.a || inputs.a.length === 0) {
        emit = inputs.b;
      }

      return { emit: emit, a: inputs.a, b: inputs.b };
    }
  )(args);
}

emitter({
  a: popItem.array,
  b: accumulate.array,
  $metadata: {
    title: "Emitter",
  },
})
  .emit.as("array")
  .to(output);

const serialised = await input.serialize({
  title: "Board for Each",
  description:
    "Iterate over an array and run a subgraph for each item in the array.",
});

export { serialised as graph, input, output };
export default serialised;
