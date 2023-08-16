// framework code

interface WireableOut<T> {
  constantWireTo: (output: WireableIn<T>) => void;
  optionalWireTo: (output: WireableIn<T>) => void;
  wireTo: (output: WireableIn<T>) => void;
}

interface WireableIn<T> {
  wireFrom: (input: WireableOut<T>) => void;
  constantWireFrom: (input: WireableOut<T>) => void;
  optionalWireFrom: (input: WireableOut<T>) => void;
}

type NodeInput<T> = {
  [P in keyof T as `$${string & P}`]: WireableIn<T>;
};

type NodeOutput<T> = {
  [P in keyof T]: WireableOut<T>;
};

const board = {
  input: <Out>() => {
    // input node
    return {} as NodeOutput<Out>;
  },
  output: <In>() => {
    // output node
    return {} as NodeInput<In>;
  },
};

// userland code

type Input = {
  say: string;
};

type Output = {
  hear: string;
};

const input = board.input<Input>();
const output = board.output<Output>();

input.say.constantWireTo(output.$hear);
input.say.optionalWireTo(output.$hear);
input.say.wireTo(output.$hear);

board.input<Input>().say.wireTo(board.output<Output>().$hear);

board.output<Output>().$hear.wireFrom(board.input<Input>().say);
