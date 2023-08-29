{
  enum WireKind {
    Required,
    Optional,
    Constant,
  }

  const board = {
    input() {
      //something
    },
    output() {
      //something
    },
    wire() {
      //something
    },
  };

  const input = board.input();
  const output = board.output();

  board.wire(input.say, output.$hear);

  const { say } = input;
  const { $hear } = output;

  board.wire(say, $hear, WireKind.Constant);
}
