import test from "ava";
import { KitBuilder } from "../src/kits/builder.js";
import { Board } from "../src/board.js";

test("KitBuilder can wrap a function", async (t) => {

  // A normal function that will be wrapped.
  const echo = (input: string) => input;
  const test = (input: string) => input;

  const MyKit = KitBuilder.wrap({ url: "test" }, { echo, test });

  const board = new Board({
    title: "Test Echo",
    description: "Test Breadboard Kit",
    version: "0.0.1",
  });

  const myKit = board.addKit(MyKit);

  t.true(myKit.echo instanceof Function);
  t.true(myKit.test instanceof Function);
});


test("KitBuilder can call a function that returns a string", async (t) => {

  // A normal function that will be wrapped.
  const echo = (echo_this: string) => echo_this;

  const MyKit = KitBuilder.wrap({ url: "test" }, { echo });

  const board = new Board({
    title: "Test Echo",
    description: "Test Breadboard Kit",
    version: "0.0.1",
  });

  const myKit = board.addKit(MyKit);

  const input = board.input();
  const echoNode = myKit.echo();

  input.wire("an_input->echo_this", echoNode);
  // result because it's just a string from a dynamic function
  echoNode.wire("result->an_output", board.output());

  const output = await board.runOnce({
    "an_input": "hello world"
  });

  t.is((<string>output["an_output"]), "hello world");

});

test("KitBuilder can call a function that returns an object", async (t) => {

  // A normal function that will be wrapped.
  const echo = (echo_this: string) => {
    return { "out": echo_this, "other": "stuff" }
  };

  const MyKit = KitBuilder.wrap({ url: "test" }, { echo });

  const board = new Board({
    title: "Test Echo",
    description: "Test Breadboard Kit",
    version: "0.0.1",
  });

  const myKit = board.addKit(MyKit);

  const input = board.input();
  const echoNode = myKit.echo();

  input.wire("an_input->echo_this", echoNode);
  // result because it's just a string from a dynamic function
  echoNode.wire("out->an_output", board.output());

  const output = await board.runOnce({
    "an_input": "hello world"
  });

  t.is((<string>output["an_output"]), "hello world");

});

test("KitBuilder can call a function that has more than one input", async (t) => {

  // A normal function that will be wrapped.
  const add = (a: number, b: number) => {
    return a + b;
  };

  const MyKit = KitBuilder.wrap({ url: "test" }, { add });

  const board = new Board({
    title: "Test Echo",
    description: "Test Breadboard Kit",
    version: "0.0.1",
  });

  const myKit = board.addKit(MyKit);

  const inputA = board.input();
  const inputB = board.input();

  const addNode = myKit.add();

  inputA.wire("a->a", addNode);
  inputB.wire("b->b", addNode);
  // result because it's just a string from a dynamic function
  addNode.wire("result->", board.output());

  const output = await board.runOnce({
    "a": 1,
    "b": 2
  });

  t.is((<number>output["result"]), 3);
});

test("KitBuilder can call a function from an external import", async (t) => {

  const js = await import("jsonschema");

  // Wrap the jsonschema validate function in a kit and expose function as a node.
  const MyKit = KitBuilder.wrap({ url: "test" }, { validate: js.default.validate });

  const board = new Board({
    title: "Test Echo",
    description: "Test Breadboard Kit",
    version: "0.0.1",
  });

  const myKit = board.addKit(MyKit);

  const inputA = board.input();
  const inputB = board.input();
  const inputC = board.input();

  const validateNode = myKit.validate();

  inputA.wire("a->instance", validateNode);
  inputB.wire("b->schema", validateNode);
  inputC.wire("c->options", validateNode);

  // result because it's just a string from a dynamic function
  validateNode.wire("errors->", board.output());

  const output = await board.runOnce({
    "a": { "hello": "world" },
    "b": { "type": "object" },
    "c": { allowUnknownAttributes: true }
  });

  const result = js.default.validate({ "hello": "world" }, { "type": "object" }, { allowUnknownAttributes: true });

  t.is(((<Array<string>>output["errors"]).length), result.errors.length);
});

test("KitBuilder can splat all the functions in the extenral library and make nodes", async (t) => {

  const js = await import("jsonschema");

  // Wrap the jsonschema validate function in a kit and expose function as a node.
  const MyKit = KitBuilder.wrap({ url: "test" }, { ...js.default });

  const board = new Board({
    title: "Test Echo",
    description: "Test Breadboard Kit",
    version: "0.0.1",
  });

  const myKit = board.addKit(MyKit);

  myKit.validate()

  // We really need to pick a library with more than one function.
  t.true(myKit.validate instanceof Function);
});
