{
  // framework code

  interface WireableOut<Node, T> {
    constantWireTo(output: WireableIn<Node, T>): Node;
    optionalWireTo(output: WireableIn<Node, T>): Node;
    wireTo(output: WireableIn<Node, T>): Node;
  }

  interface WireableIn<Node, T> {
    wireFrom(input: WireableOut<Node, T>): Node;
    constantWireFrom(input: WireableOut<Node, T>): Node;
    optionalWireFrom(input: WireableOut<Node, T>): Node;
  }

  type NodeInput<Node, T> = {
    [P in keyof T as `$${string & P}`]: WireableIn<Node, T>;
  };

  type NodeOutput<Node, T> = {
    [P in keyof T]: WireableOut<Node, T>;
  };

  type AbsoluteWires<Node, In, Out> = {
    wireAllTo(output: NodeInterface<Node, In, Out>): Node;
    wireControlOnlyTo(output: NodeInterface<Node, In, Out>): Node;
    wireAllFrom(input: NodeInterface<Node, In, Out>): Node;
    wireControlOnlyFrom(input: NodeInterface<Node, In, Out>): Node;
  };

  type NodeInterface<Node, In, Out> = NodeInput<Node, In> &
    NodeOutput<Node, Out> &
    AbsoluteWires<Node, In, Out>;

  class Board {
    input<Out = { text: string }>(): NodeInterface<Board, object, Out> {
      // input node
      return {} as NodeInterface<Board, object, Out>;
    }
    output<In = { text: string }>() {
      // output node
      return {} as NodeInterface<Board, In, object>;
    }
  }
  const board = new Board();

  // userland code

  type BoardInputs = {
    say: string;
  };

  type BoardOutputs = {
    hear: string;
  };

  const input = board.input<BoardInputs>();
  const output = board.output<BoardOutputs>();

  input.say.constantWireTo(output.$hear);
  input.say.optionalWireTo(output.$hear);
  input.say.wireTo(output.$hear);

  board.input<BoardInputs>().say.wireTo(board.output<BoardOutputs>().$hear);

  board.output<BoardOutputs>().$hear.wireFrom(board.input<BoardInputs>().say);
}
