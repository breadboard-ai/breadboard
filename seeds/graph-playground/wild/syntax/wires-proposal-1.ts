// framework code

const board = {
  input: <T>(): T => {
    // input node
    return {} as T;
  },
  output: <T>(): T => {
    // output node
    return {} as T;
  },
};

interface WireOut<T> {
  constantWireTo: (output: WireIn<T>) => void;
  optionalWireTo: (output: WireIn<T>) => void;
  wireTo: (output: WireIn<T>) => void;
}

interface WireIn<T> {
  wireFrom: (input: WireOut<T>) => void;
  constantWireFrom: (input: WireOut<T>) => void;
  optionalWireFrom: (input: WireOut<T>) => void;
}

// userland code

type Input = {
  say: WireOut<string>;
};

type Output = {
  $hear: WireIn<string>;
};

const input = board.input<Input>();
const output = board.output<Output>();

input.say.constantWireTo(output.$hear);
input.say.optionalWireTo(output.$hear);
input.say.wireTo(output.$hear);

board.input<Input>().say.wireTo(board.output<Output>().$hear);

board.output<Output>().$hear.wireFrom(board.input<Input>().say);
