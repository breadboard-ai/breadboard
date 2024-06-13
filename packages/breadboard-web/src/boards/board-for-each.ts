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
  const input = base.input({});

  const reverse = code<{ item: string }, { item: string }>((inputs) => {
    const { item } = inputs;
    return { item: item.split("").reverse().join("") };
  })(input.item);

  const output = base.output({});
  reverse.to(output);
  return output;
}).serialize();
const input = base.input({
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

const invocation = core.invoke({
  $board: input.board,
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
popItem.item.to(invocation);

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

accumulate.array.to(accumulate);
accumulate.array.to(output);

const serialised = await output.serialize({
  title: "Board For Each",
  description:
    "Iterate over an array and run a subgraph for each item in the array.",
});

export { serialised as graph, input, output };
export default serialised;
