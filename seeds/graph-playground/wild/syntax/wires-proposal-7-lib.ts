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
  as(keymap: KeyMap): Value;
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

class NodeImpl<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> implements NodeProxyInterface<I, O>, PromiseLike<O>
{
  id: string;
  type: string;
  outgoing: Edge[] = [];
  incoming: Edge[] = [];
  config: InputValues = {};

  #handler: NodeHandler<I, O>;

  #promise: Promise<O>;
  #resolve?: (value: O | PromiseLike<O>) => void;
  #reject?: (reason?: unknown) => void;

  #inputs: InputValues;
  #receivedFrom: NodeImpl[] = [];
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
      this.addInputAsNode(config);
    } else if (config instanceof Value) {
      this.addInputAsNode(...config.asNodeInput());
    } else {
      const { $id, ...rest } = config as Partial<InputsMaybeAsValues<I>> & {
        $id?: string;
      };
      id = $id;
      this.addInputsAsValues(rest as InputsMaybeAsValues<I>);
    }

    this.#inputs = { ...this.config };

    this.id = id || getNextNodeId(this.type);

    // Set up spread value, so that { ...node } as input works.
    (this as unknown as { [key: string]: NodeImpl<I, O> })[this.#spreadKey()] =
      this;

    this.#promise = new Promise<O>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  addInputsAsConstants(values: InputValues) {
    this.config = { ...this.config, ...values };
  }

  addInputsAsValues(values: InputsMaybeAsValues<I>) {
    // Split into constants and nodes
    const constants: Partial<InputValues> = {};
    const nodes: [NodeImpl<InputValues, OutputValues>, KeyMap][] = [];

    Object.entries(values).forEach(([key, value]) => {
      if (value instanceof Value) {
        nodes.push(value.asNodeInput());
      } else if (value instanceof NodeImpl) {
        nodes.push([value.unProxy(), { [key]: key }]);
      } else {
        constants[key] = value;
      }
    });

    this.addInputsAsConstants(constants);
    nodes.forEach((node) => this.addInputAsNode(...node));
  }

  // Add inputs from another node as edges
  addInputAsNode(from: NodeImpl, keymap: KeyMap = { "*": "*" }) {
    Object.entries(keymap).forEach(([fromKey, toKey]) => {
      // "*-<id>" means "all outputs from <id>" and comes from using a node in a
      // spread, e.g. newNode({ ...node, $id: "id" }
      if (fromKey.startsWith("*-")) fromKey = toKey = "*";

      const edge: Edge = {
        to: this as unknown as NodeImpl,
        from,
        out: fromKey,
        in: toKey,
      };

      this.incoming.push(edge);
      from.outgoing.push(edge);
    });
  }

  receiveInputs(inputs: Partial<I>, from: NodeImpl) {
    this.#inputs = { ...this.#inputs, ...inputs };
    this.#receivedFrom.push(from);
  }

  /**
   * Compute required inputs from edges and compare with present inputs
   *
   * Required inputs are
   *  - for all named incoming edges, the presence of any data, irrespective of
   *    which node they come from
   *  - for all empty or * incoming edges, that the from node has sent data
   *  - data from at least one node if it already ran (#this.outputs not empty)
   *
   * @returns true if all required inputs are present
   */
  hasAllRequiredInputs() {
    const requiredKeys = new Set(
      this.incoming
        .map((edge) => edge.in)
        .filter((key) => !["", "*"].includes(key))
    );
    const requiredNodes = new Set(
      this.incoming
        .filter((edge) => ["", "*"].includes(edge.out))
        .map((edge) => edge.from)
    );

    const presentKeys = new Set(Object.keys(this.#inputs));
    const presentNodes = new Set(this.#receivedFrom);

    return (
      [...requiredKeys].every((key) => presentKeys.has(key)) &&
      [...requiredNodes].every((node) => presentNodes.has(node)) &&
      (!this.#outputs || presentNodes.size > 0)
    );
  }

  async invoke(): Promise<O> {
    if (!this.#runner) throw Error("Need a runner to invoke");

    const runner = new Runner(this.#runner);
    return runner.asRunnerFor(async () => {
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

        // Resolve promise, but only on first run (outputs is still empty)
        if (this.#resolve && !this.#outputs) this.#resolve(result);

        this.#outputs = result;

        this.#inputs = { ...this.config };
        this.#receivedFrom = [];

        return result;
      } catch (e) {
        // Reject promise, but only on first run (outputs is still empty)
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
      ownKeys(target) {
        return [target.#spreadKey()];
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
    this.#runner.invoke(this as unknown as NodeImpl);

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
    toNode.addInputAsNode(this as unknown as NodeImpl, { "*": "*" });

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
      this.addInputAsNode(node);
    } else if (inputs instanceof Value) {
      const value = inputs as Value;
      this.addInputAsNode(...value.asNodeInput());
    } else {
      const values = inputs as InputsMaybeAsValues<I>;
      this.addInputsAsValues(values);
    }
    return this.asProxy();
  }

  as(keymap: KeyMap): Value {
    return new Value<NodeValue>(
      this as unknown as NodeImpl,
      this.#runner,
      keymap
    );
  }

  keys() {
    return [this.#spreadKey()];
  }

  #spreadKey() {
    return "*-" + this.id;
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
    NodeImpl<InputValues, OutputValues>,
    { [key: string]: string }
  ] {
    return [
      this.#node.unProxy() as NodeImpl<InputValues, OutputValues>,
      this.#keymap,
    ];
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

    toNode.addInputAsNode(this.#node as unknown as NodeImpl, this.#keymap);

    return (toNode as NodeImpl<OutputValue<T> & ToC, ToO>).asProxy();
  }

  in(inputs: NodeImpl<InputValues, OutputValues> | InputValues) {
    if (inputs instanceof NodeImpl || inputs instanceof Value) {
      let invertedMap = Object.fromEntries(
        Object.entries(this.#keymap).map(([fromKey, toKey]) => [toKey, fromKey])
      );
      if (inputs instanceof Value) invertedMap = inputs.#remapKeys(invertedMap);
      const node = inputs instanceof NodeImpl ? inputs : inputs.#node;
      this.#node.addInputAsNode(node, invertedMap);
    } else {
      this.#node.addInputsAsValues(inputs);
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

  async invoke(node: NodeImpl) {
    const queue: NodeImpl[] = this.#findAllConnectedNodes(node).filter((node) =>
      node.hasAllRequiredInputs()
    );

    while (queue.length) {
      const node = queue.shift() as NodeImpl;

      // Check if we have all inputs. This should always be the case.
      if (!node.hasAllRequiredInputs())
        throw new Error("Node in queue didn't have all required inputs. Bug.");

      // Invoke node
      const result = await node.invoke();

      // Distribute data to outgoing edges
      node.outgoing.forEach((edge) => {
        const data =
          edge.out === "*" ? result : { [edge.in]: result[edge.out] };
        edge.to.receiveInputs(data, node);

        // If it's ready to run, add it to the queue
        if (edge.to.hasAllRequiredInputs()) queue.push(edge.to);
      });
    }
  }

  #findAllConnectedNodes(node: NodeImpl) {
    const nodes = new Set<NodeImpl>();
    const queue = [node];

    while (queue.length) {
      const node = queue.shift() as NodeImpl;
      if (nodes.has(node)) continue;
      nodes.add(node);
      node.incoming.forEach((edge) => queue.push(edge.from));
      node.outgoing.forEach((edge) => queue.push(edge.to));
    }

    return [...nodes];
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
