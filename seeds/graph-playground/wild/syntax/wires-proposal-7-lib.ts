/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | NodeValue[]
  | PromiseLike<NodeValue>
  | { [key: string]: NodeValue }
  | NodeFactory<InputValues, OutputValues>;

type NodeTypeIdentifier = string;

export type InputValues = { [key: string]: NodeValue };

export type OutputValues = { [key: string]: NodeValue };
type OutputValue<T> = Partial<{ [key: string]: T }>;

type InputsMaybeAsValues<
  T extends InputValues,
  NI extends InputValues = InputValues
> = Partial<{
  [K in keyof T]: Value<T[K]> | NodeProxy<NI, OutputValue<T[K]>> | T[K];
}> & {
  [key in string]:
    | Value<NodeValue>
    | NodeProxy<NI, Partial<InputValues>>
    | NodeValue;
};

type NodeHandlerFunction<I extends InputValues, O extends OutputValues> = (
  inputs: PromiseLike<I> & InputsMaybeAsValues<I>,
  node: NodeImpl<I, O>
) => O | PromiseLike<O>;

type NodeHandler<I extends InputValues, O extends OutputValues> =
  | {
      invoke: NodeHandlerFunction<I, O>;
      // describe?: NodeDescriberFunction<I, O>;
      acceptsPromises?: boolean;
    }
  | NodeHandlerFunction<I, O>; // Is assumed to accept promises

type NodeHandlers = Record<
  NodeTypeIdentifier,
  NodeHandler<InputValues, OutputValues>
>;

const handlers: NodeHandlers = {};

type NodeFactory<I extends InputValues, O extends OutputValues> = (
  config?: NodeImpl<InputValues, I> | Value<NodeValue> | InputsMaybeAsValues<I>
) => NodeProxy<I, O>;

export function addNodeType<I extends InputValues, O extends OutputValues>(
  name: string,
  fn: NodeHandlerFunction<I, O>
): NodeFactory<I, O> {
  (handlers[name] as unknown as NodeHandlerFunction<I, O>) = fn;
  return ((config?: InputsMaybeAsValues<I>) => {
    return new NodeImpl(name, getCurrentContextRunner(), config).asProxy();
  }) as unknown as NodeFactory<I, O>;
}

export function action<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
>(fn: NodeHandlerFunction<I, O>): NodeFactory<I, O> {
  return addNodeType(getNextNodeId("fn"), fn);
}

interface Edge<
  FromI extends InputValues = InputValues,
  FromO extends OutputValues = OutputValues,
  ToI extends InputValues = InputValues,
  ToO extends OutputValues = OutputValues
> {
  from: NodeImpl<FromI, FromO>;
  to: NodeImpl<ToI, ToO>;
  out: string;
  in: string;
}

let nodeIdCounter = 0;
const getNextNodeId = (type: string) => {
  return `${type}-${nodeIdCounter++}`;
};

type NodeProxyInterface<I extends InputValues, O extends OutputValues> = {
  then<TResult1 = O, TResult2 = never>(
    onfulfilled?: ((value: O) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
  to<
    ToO extends OutputValues = OutputValues,
    ToC extends InputValues = InputValues
  >(
    to:
      | NodeProxy<O & ToC, ToO>
      | NodeTypeIdentifier
      | NodeHandler<O & ToC, ToO>,
    config?: ToC
  ): NodeProxy<O & ToC, ToO>;
  in(
    inputs:
      | NodeProxy<InputValues, Partial<I>>
      | InputsMaybeAsValues<I>
      | Value<NodeValue>
  ): NodeProxy<I, O>;
  as(newKey: object): NodeProxy<I, O>;
};

/**
 * Intersection between a Node and a Promise for its output:
 *  - Has all the output fields as Value<T> instances.
 *  - Has all the methods of the NodeProxyInterface defined above.
 *  - Including then() which makes it a PromiseLike<O>
 */
export type NodeProxy<I extends InputValues, O extends OutputValues> = {
  [K in keyof O]: Value<O[K]> & ((...args: unknown[]) => unknown);
} & {
  [key in string]: Value<NodeValue> & ((...args: unknown[]) => unknown);
} & NodeProxyInterface<I, O>;

type KeyMap = { [key: string]: string };

const SpreadThis = Symbol("SpreadThis");

class NodeImpl<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> implements NodeProxyInterface<I, O>, PromiseLike<O>
{
  id: string;
  type: string;
  outgoing: Edge[] = [];
  incoming: Edge[] = [];

  [SpreadThis] = this;

  #handler: NodeHandler<I, O>;

  #promise?: Promise<O>;
  #resolve?: (value: O | PromiseLike<O>) => void;
  #reject?: (reason?: unknown) => void;

  #invoked = false;

  #inputs: (
    | InputsMaybeAsValues<I>
    | [KeyMap, NodeImpl<InputValues, OutputValues>]
  )[] = [];
  #outputs?: O;
  #runner: Runner;

  constructor(
    handler: NodeTypeIdentifier | NodeHandler<I, O>,
    runner: Runner,
    config: (Partial<InputsMaybeAsValues<I>> | Value<NodeValue>) & {
      $id?: string;
    } = {}
  ) {
    this.#runner = runner;

    if (typeof handler === "string") {
      if (!handlers[handler]) throw Error(`Handler ${handler} not found`);
      this.type = handler;
      this.#handler = handlers[handler] as unknown as NodeHandler<I, O>;
    } else {
      this.type = "fn";
      this.#handler = handler;
    }

    let id: string | undefined = undefined;

    if (config instanceof NodeImpl) {
      this.#inputs.push([
        {},
        config as unknown as NodeImpl<InputValues, OutputValues>,
      ]);
    } else if (config instanceof Value) {
      this.#inputs.push(config.asNodeInput());
    } else {
      const { $id, ...rest } = config as Partial<InputsMaybeAsValues<I>> & {
        $id?: string;
      };
      id = $id;
      this.#inputs.push(rest as InputsMaybeAsValues<I>);
    }

    this.id = id || getNextNodeId(this.type);
  }

  // TODO: Turn these into edges if they are NodeImpl or Value instances.
  addInputs(
    inputs:
      | InputsMaybeAsValues<I>
      | [KeyMap, NodeImpl<InputValues, OutputValues>]
  ) {
    this.#inputs.push(inputs);
  }

  invoke() {
    // TODO: Instead reset at the end, but need to figure out promises here.

    if (this.#invoked)
      throw Error("Can't invoke twice without first resetting");
    this.#invoked = true;

    if (!this.#runner) throw Error("Need a runner to invoke");

    const runner = new Runner(this.#runner);
    runner.asRunnerFor(async () => {
      try {
        const handler =
          typeof this.#handler === "function"
            ? this.#handler
            : this.#handler.invoke;

        // Note: The handler might actually return a graph (as a NodeProxy), and
        // so the await might triggers its execution. This is what we want.
        const result = await runner.asRunnerFor(handler)(
          this.#inputs as unknown as PromiseLike<I> & InputsMaybeAsValues<I>,
          this
        );

        if (this.#resolve) this.#resolve(result);

        return result;
      } catch (e) {
        if (this.#reject) this.#reject(e);
        throw e;
      }
    })();
  }

  /**
   * Creates a proxy for a Node that is used when constructing a graph.
   *
   *   const node = originalNode.asProxy();
   *
   * It acts as a Promise for the Node's output by implementing a `then` method:
   *   const output = await node;
   *
   * It acts a proxy for Promises for the Node's output's members.
   *   const field = await node.field;
   *
   * You can still call methods on the Node:
   *   node.to(nextNode);
   *
   * You can do that on output members too:
   *   node.field.to(nextNode);
   *
   * This even works for its methods and `then` and other reserved words:
   *   const to = await node.to;
   *   const thenValue = await node.then; // note: not then()
   *   node.then.to(nextNode); // send the value of `then` to nextNode
   *   node.to.to(nextNode);   // same for the value of `to`.
   *
   *
   * To achieve this, we use a Proxy that creates instances of Value for each
   * requested key, as if it was an output of the node. If there is a method on
   * node with the same name, we return a proxy for that method instead, that
   * forwards all gets to the Value instance. As this includes the `then` method
   * defined on the value, `await node.foo` works, even though `node.foo` is a a
   * function. That it is a function is important for `node.then`, so that the
   * node acts like a Promise as well.
   *
   */
  // TODO: Hack keys() to make spread work
  asProxy(): NodeProxy<I, O> {
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === "string") {
          const value = new Value(
            target as unknown as NodeImpl<InputValues, OutputValues>,
            target.#runner,
            prop
          );
          const method = target[prop as keyof NodeImpl<I, O>] as () => void;
          if (method && typeof method === "function") {
            return new Proxy(method.bind(target), {
              get(_, key, __) {
                return Reflect.get(value, key, value);
              },
            });
          } else {
            return value;
          }
        } else {
          return Reflect.get(target, prop, receiver);
        }
      },
      ownKeys(_) {
        return [SpreadThis];
      },
    }) as unknown as NodeProxy<I, O>;
  }

  /**
   * Retrieve underlying node from a NodeProxy. Use like this:
   *
   * if (thing instanceof NodeImpl) { const node = thing.unProxy(); }
   *
   * @returns A NodeImpl that is not a proxy, but the original NodeImpl.
   */
  unProxy() {
    return this;
  }

  /****
   * Implementations of NodeProxyInterface, used for constructing Graphs,
   * typically invoked on this.asProxy().
   */

  /**
   * Makes the node (and its proxy) act as a Promise, which returns the output
   * of the node. This trigger the execution of the graph built up so far.
   *
   * this.#promise is a Promise that gets resolved with the (first and only the
   * first) invoke() call of the node. It is resolved with the outputs.
   */
  then<TResult1 = O, TResult2 = never>(
    onfulfilled?: ((value: O) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    if (!this.#promise) {
      this.#promise = new Promise<O>((resolve, reject) => {
        this.#resolve = resolve;
        this.#reject = reject;
      });
    }

    this.#runner.invoke(this);

    return this.#promise.then(
      onfulfilled && this.#runner.asRunnerFor(onfulfilled),
      onrejected && this.#runner.asRunnerFor(onrejected)
    );
  }

  to<
    ToO extends OutputValues = OutputValues,
    ToC extends InputValues = InputValues
  >(
    to:
      | NodeProxy<O & ToC, ToO>
      | NodeTypeIdentifier
      | NodeHandler<O & ToC, ToO>,
    config?: ToC
  ): NodeProxy<O & ToC, ToO> {
    const toNode =
      to instanceof NodeImpl
        ? to.unProxy()
        : new NodeImpl(
            to as NodeTypeIdentifier | NodeHandler<Partial<O> & ToC, ToO>,
            this.#runner,
            config as Partial<O> & ToC
          );

    // TODO: Ideally we would look at the schema here and use * only if
    // the output is open ended and/or not all fields are present all the time.
    const edge: Edge = {
      to: toNode as unknown as NodeImpl,
      from: this as unknown as NodeImpl,
      out: "*",
      in: "*",
    };

    this.outgoing.push(edge);
    toNode.incoming.push(edge);

    return (toNode as NodeImpl<O & ToC, ToO>).asProxy();
  }

  in(
    inputs:
      | NodeProxy<InputValues, Partial<I>>
      | InputsMaybeAsValues<I>
      | Value<NodeValue>
  ) {
    if (inputs instanceof NodeImpl) {
      const node = inputs as NodeImpl<InputValues, OutputValues>;
      this.addInputs([{}, node]);
    } else if (inputs instanceof Value) {
      const value = inputs as Value;
      this.addInputs(value.asNodeInput());
    } else {
      const values = inputs as InputsMaybeAsValues<I>;
      this.addInputs(values);
    }
    return this.asProxy();
  }

  as(newKey: object): NodeProxy<I, O> {
    throw Error(`$as(${newKey}) in Node not implemented yet.`);
  }

  keys() {
    return [SpreadThis];
  }
}

class Value<T extends NodeValue = NodeValue>
  implements PromiseLike<T | undefined>
{
  #node: NodeImpl<InputValues, OutputValue<T>>;
  #runner: Runner;
  #keymap: KeyMap;

  constructor(
    node: NodeImpl<InputValues, OutputValue<T>>,
    runner: Runner,
    keymap: string | KeyMap
  ) {
    this.#node = node;
    this.#runner = runner;
    this.#keymap = typeof keymap === "string" ? { [keymap]: keymap } : keymap;
  }

  then<TResult1 = T | undefined, TResult2 = never>(
    onfulfilled?:
      | ((value: T | undefined) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    if (Object.keys(this.#keymap).length !== 1)
      throw Error("Can't `await` for multiple values");
    return this.#node.then(
      (o) =>
        o &&
        onfulfilled &&
        this.#runner.asRunnerFor(onfulfilled)(o[Object.keys(this.#keymap)[0]]),
      onrejected && this.#runner.asRunnerFor(onrejected)
    ) as PromiseLike<TResult1 | TResult2>;
  }

  asNodeInput(): [
    { [key: string]: string },
    NodeImpl<InputValues, OutputValues>
  ] {
    return [this.#keymap, this.#node as NodeImpl<InputValues, OutputValues>];
  }

  to<
    ToO extends OutputValues = OutputValues,
    ToC extends InputValues = InputValues
  >(
    to:
      | NodeProxy<OutputValue<T> & ToC, ToO>
      | NodeTypeIdentifier
      | NodeHandler<OutputValue<T> & ToC, ToO>,
    config?: ToC
  ) {
    const toNode =
      to instanceof NodeImpl
        ? to.unProxy()
        : new NodeImpl(
            to as NodeTypeIdentifier | NodeHandler<OutputValue<T> & ToC, ToO>,
            this.#runner,
            config as OutputValue<T> & ToC
          );

    Object.entries(this.#keymap).forEach(([fromKey, toKey]) => {
      const edge: Edge = {
        to: toNode as unknown as NodeImpl,
        from: this.#node as NodeImpl,
        out: fromKey,
        in: toKey,
      };

      this.#node.outgoing.push(edge);
      toNode.incoming.push(edge);
    });

    return (toNode as NodeImpl<OutputValue<T> & ToC, ToO>).asProxy();
  }

  in(inputs: NodeImpl<InputValues, OutputValues> | InputValues) {
    if (inputs instanceof NodeImpl || inputs instanceof Value) {
      let invertedMap = Object.fromEntries(
        Object.entries(this.#keymap).map(([fromKey, toKey]) => [toKey, fromKey])
      );
      if (inputs instanceof Value) invertedMap = inputs.#remapKeys(invertedMap);
      const node = inputs instanceof NodeImpl ? inputs : inputs.#node;
      this.#node.addInputs([invertedMap, node]);
    } else {
      this.#node.addInputs(inputs as Partial<InputValues>);
    }
  }

  as(newKey: string | KeyMap): Value<T> {
    let newMap: KeyMap;
    if (typeof newKey === "string") {
      if (Object.keys(this.#keymap).length !== 1)
        throw new Error("Can't rename multiple values with a single string");
      newMap = { [Object.keys(this.#keymap)[0]]: newKey };
    } else {
      newMap = this.#remapKeys(newKey);
    }

    return new Value(this.#node, this.#runner, newMap);
  }

  #remapKeys(newKeys: KeyMap) {
    const newMap = { ...this.#keymap };
    Object.entries(newKeys).forEach(([fromKey, toKey]) => {
      if (this.#keymap[toKey]) {
        newMap[fromKey] = this.#keymap[toKey];
        delete this.#keymap[toKey];
      } else {
        newMap[fromKey] = toKey;
      }
    });
    return newMap;
  }
}

export class Runner {
  #nodes = new Map<string, NodeImpl<InputValues, OutputValues>>();
  #parent?: Runner;

  constructor();
  constructor(runner: Runner);

  constructor(runner?: Runner) {
    if (runner) {
      this.#parent = runner;
    }
  }

  /**
   * Swap global runner with this one, run the function, then restore
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  asRunnerFor<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: unknown[]) => {
      const oldRunner = swapCurrentContextRunner(this);
      try {
        return fn(...args);
      } finally {
        swapCurrentContextRunner(oldRunner);
      }
    }) as T;
  }

  flow<I extends InputValues, O extends OutputValues>(
    nodeOrFunction: NodeImpl<I, O> | NodeHandlerFunction<I, O>,
    config?: InputsMaybeAsValues<I>
  ): NodeProxy<InputValues, OutputValues> {
    const node =
      nodeOrFunction instanceof NodeImpl
        ? nodeOrFunction
        : new NodeImpl(
            nodeOrFunction as NodeHandlerFunction<I, O>,
            this,
            config
          );
    return node.asProxy();
  }

  invoke<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues
  >(node: NodeImpl<I, O>) {
    // TODO: This should run the whole graph, not just a single node.
    node.invoke();
  }
}

/**
 * The following is inspired by zone.js, but much simpler, and crucially doesn't
 * require monkey patching.
 *
 * Instead, we use a global variable to store the current runner, and swap it
 * out when we need to run a function in a different context.
 *
 * Runner.asRunnerFor() wraps a function that runs with that Runner as context.
 *
 * flow, action and any nodeFactory will run with the current Runner as context.
 *
 * Crucially (and that's all we need from zone.js), {NodeImpl,Value}.then() call
 * onsuccessful and onrejected with the Runner as context. So even if the
 * context changed in the meantime, due to async calls, the rest of a flow
 * defining function will run with the current Runner as context.
 *
 * This works because NodeImpl and Value are PromiseLike, and so their then() is
 * called when they are awaited. Importantly, there is context switch between
 * the await call and entering then(), and there is no context switch between
 * then() and the onsuccessful or onrejected call.
 *
 * One requirement from this that there can't be any await in the body of a flow
 * or action function, if they are followed by either node creation or flow
 * calls. This is also a requirement for restoring state after interrupting a
 * flow.
 */

// Initialize with a default global Runner.
let currentContextRunner = new Runner();

function getCurrentContextRunner() {
  const runner = currentContextRunner;
  if (!runner) throw Error("No runner found in context");
  return runner;
}

function swapCurrentContextRunner(runner: Runner) {
  const oldRunner = currentContextRunner;
  currentContextRunner = runner;
  return oldRunner;
}

// flow will execute in the current Runner's context:
export const flow = <I extends InputValues, O extends OutputValues>(
  nodeOrFunction: NodeImpl<I, O> | NodeHandlerFunction<I, O>,
  config?: InputsMaybeAsValues<I>
) => {
  return getCurrentContextRunner().flow(nodeOrFunction, config);
};
