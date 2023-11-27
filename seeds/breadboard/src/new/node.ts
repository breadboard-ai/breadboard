/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphMetadata,
  NodeDescriptor,
  InputValues as OriginalInputValues,
} from "@google-labs/breadboard";
import {
  InputValues,
  OutputValues,
  NodeHandler,
  InputsMaybeAsValues,
  NodeHandlerFunction,
  NodeTypeIdentifier,
  NodeValue,
  Serializeable,
  NodeProxy,
  NodeProxyMethods,
  KeyMap,
  AbstractNode,
  AbstractValue,
  EdgeInterface,
} from "./types.js";

import { Scope } from "./scope.js";
import { TrapResult, TrappedDataReadWhileSerializing } from "./trap.js";
import { Value, isValue } from "./value.js";

import { IdVendor } from "../id.js";

export const nodeIdVendor = new IdVendor();

// TODO:BASE Extract base class that isn't opinionated about the syntax. Marking
// methods that should be base as "TODO:BASE" below, including complications.
export class NodeImpl<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues
  >
  extends AbstractNode<I, O>
  implements NodeProxyMethods<I, O>, PromiseLike<O>, Serializeable
{
  id: string;
  type: string;
  outgoing: EdgeInterface[] = [];
  incoming: EdgeInterface[] = [];
  configuration: Partial<I> = {};

  #handler?: NodeHandler<InputValues, OutputValues>;

  #promise: Promise<O>;
  #resolve?: (value: O | PromiseLike<O>) => void;
  #reject?: (reason?: unknown) => void;

  #inputs: Partial<I>;
  #constants: Partial<I> = {};
  #incomingEmptyWires: AbstractNode[] = [];
  #outputs?: O;

  #scope: Scope;

  // TODO:BASE: The syntax specific one will
  // - handle passing functions
  // - extract the wires from the config
  // - then call the original constructor
  // - then add the wires
  // - then add the spread value hack
  // - then add the promises
  //
  // Open question: Is assigning of default ids something the base class does or
  // should it error out if there isn't an id and require each syntax to define
  // their own default id generation scheme?
  constructor(
    handler: NodeTypeIdentifier | NodeHandler<I, O>,
    scope: Scope,
    config: (Partial<InputsMaybeAsValues<I>> | AbstractValue<NodeValue>) & {
      $id?: string;
    } = {}
  ) {
    super();

    this.#scope = scope;

    if (typeof handler === "string") {
      this.type = handler;
    } else {
      this.type = "fn";
      this.#handler = handler as unknown as NodeHandler<
        InputValues,
        OutputValues
      >;
    }

    let id: string | undefined = undefined;

    if (config instanceof NodeImpl) {
      this.addInputsFromNode(config.unProxy());
    } else if (isValue(config)) {
      this.addInputsFromNode(...(config as Value).asNodeInput());
    } else {
      const { $id, ...rest } = config as Partial<InputsMaybeAsValues<I>> & {
        $id?: string;
      };
      id = $id;
      this.addInputsAsValues(rest as InputsMaybeAsValues<I>);

      // Treat incoming constants as configuration
      this.configuration = { ...this.configuration, ...this.#constants };
      this.#constants = {};
    }

    this.#inputs = { ...this.configuration };

    this.id = id || nodeIdVendor.vendId(scope, this.type);

    // Set up spread value, so that { ...node } as input works.
    (this as unknown as { [key: string]: NodeImpl<I, O> })[this.#spreadKey()] =
      this;

    this.#promise = new Promise<O>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  addInputsAsValues(values: InputsMaybeAsValues<I>) {
    // Split into constants and nodes
    const constants: Partial<InputValues> = {};
    const nodes: [NodeImpl<InputValues, OutputValues>, KeyMap, boolean][] = [];

    Object.entries(values).forEach(([key, value]) => {
      if (isValue(value)) {
        nodes.push((value as Value).as(key).asNodeInput());
      } else if (value instanceof NodeImpl) {
        nodes.push([value.unProxy(), { [key]: key }, false]);
      } else {
        constants[key] = value;
      }
    });

    this.#constants = { ...this.#constants, ...constants };
    nodes.forEach((node) => this.addInputsFromNode(...node));
  }

  // Add inputs from another node as edges
  addInputsFromNode(
    from: NodeImpl,
    keymap: KeyMap = { "*": "*" },
    constant?: boolean
  ) {
    const keyPairs = Object.entries(keymap);
    if (keyPairs.length === 0) {
      // Add an empty edge: Just control flow, no data moving.
      const edge: EdgeInterface = {
        to: this as unknown as NodeImpl,
        from,
        out: "",
        in: "",
      };
      this.incoming.push(edge);
      from.outgoing.push(edge);
    } else
      keyPairs.forEach(([fromKey, toKey]) => {
        // "*-<id>" means "all outputs from <id>" and comes from using a node in
        // a spread, e.g. newNode({ ...node, $id: "id" }
        if (fromKey.startsWith("*-")) fromKey = toKey = "*";

        const edge: EdgeInterface = {
          to: this as unknown as NodeImpl,
          from,
          out: fromKey,
          in: toKey,
        };

        if (constant) edge.constant = true;

        this.incoming.push(edge);
        from.outgoing.push(edge);
      });
  }

  // TODO:BASE (this shouldn't require any changes)
  receiveInputs(edge: EdgeInterface, inputs: InputValues) {
    const data =
      edge.out === "*"
        ? inputs
        : edge.out === ""
        ? {}
        : inputs[edge.out] !== undefined
        ? { [edge.in]: inputs[edge.out] }
        : {};
    if (edge.constant) this.#constants = { ...this.#constants, ...data };
    this.#inputs = { ...this.#inputs, ...data };

    if (edge.out === "") this.#incomingEmptyWires.push(edge.from);

    // return which wires were used
    return Object.keys(data);
  }

  // TODO:BASE (this shouldn't require any changes)
  /**
   * Compute required inputs from edges and compare with present inputs
   *
   * Required inputs are
   *  - for all named incoming edges, the presence of any data, irrespective of
   *    which node they come from
   *  - at least one of the empty (control flow edges), if present
   *  - at least one of * incoming edges (TODO: Is that correct?)
   *  - data from at least one node if it already ran (#this.outputs not empty)
   *
   * @returns false if none are missing, otherwise string[] of missing inputs.
   * NOTE: A node with no incoming wires returns an empty array after  first run.
   */
  missingInputs(): string[] | false {
    if (this.incoming.length === 0 && this.#outputs) return [];

    const requiredKeys = new Set(this.incoming.map((edge) => edge.in));

    const presentKeys = new Set([
      ...Object.keys(this.#inputs),
      ...Object.keys(this.#constants),
    ]);
    if (this.#incomingEmptyWires.length) presentKeys.add("");

    const missingInputs = [...requiredKeys].filter(
      (key) => !presentKeys.has(key)
    );

    return missingInputs.length ? missingInputs : false;
  }

  // TODO:BASE
  getInputs() {
    return { ...this.#inputs };
  }

  #getHandlerFunction(scope: Scope) {
    const handler = this.#handler ?? scope.getHandler(this.type);
    if (!handler) throw new Error(`Handler ${this.type} not found`);
    return typeof handler === "function" ? handler : handler.invoke;
  }

  #getHandlerDescribe(scope: Scope) {
    const handler = this.#handler ?? scope.getHandler(this.type);
    if (!handler) throw new Error(`Handler ${this.type} not found`);
    return typeof handler === "function" ? undefined : handler.describe;
  }

  // TODO:BASE: In the end, we need to capture the outputs and resolve the
  // promise. But before that there is a bit of refactoring to do to allow
  // returning of graphs, parallel execution, etc.
  async invoke(invokingScope?: Scope): Promise<O> {
    const scope = new Scope({ invokingScope, declaringScope: this.#scope });
    return scope.asScopeFor(async () => {
      try {
        const handler = this.#getHandlerFunction(
          scope
        ) as unknown as NodeHandlerFunction<I, O>;

        // Note: The handler might actually return a graph (as a NodeProxy), and
        // so the await might triggers its execution. This is what we want.
        //
        // Awaiting here means that parallel execution isn't possible.
        // TODO: Return a promise that knows how to do the rest. Make sure to
        // never invoke the handler twice while it is running, though.
        //
        // TODO: What this should do instead is much closer to what the
        // serialization code below does. It should:
        //  - add an input node, assign the inputs to it
        //  - call the handler with that input node's proxy (this gives it all
        //    the values, but as promises) if it supports promises, otherwise
        //    call it with the values directly.
        //  - if the handler returns a node (i.e. a graph), and
        //    - it isn't an output node, add an output node and wire it up
        //    - execute the graph, and return the output node's outputs
        //  - otherwise return the handler's return value as result.
        const result = (await handler(
          this.#inputs as unknown as PromiseLike<I> & InputsMaybeAsValues<I>,
          this
        )) as O;

        // Resolve promise, but only on first run (outputs is still empty)
        if (this.#resolve && !this.#outputs) this.#resolve(result);

        this.#outputs = result;

        // Clear inputs, reset with configuration and constants
        this.#inputs = { ...this.configuration, ...this.#constants };
        this.#incomingEmptyWires = [];

        return result;
      } catch (e) {
        // Reject promise, but only on first run (outputs is still empty)
        if (this.#reject && !this.#outputs) this.#reject(e);
        throw e;
      }
    })();
  }

  // TODO:BASE
  async serialize(metadata?: GraphMetadata) {
    return this.#scope.serialize(this as unknown as NodeImpl, metadata);
  }

  // TODO:BASE Special casing the function case (which is most of the code
  // here), everything else is the same, but really just the first few lines
  // here.
  async serializeNode(): Promise<[NodeDescriptor, GraphDescriptor?]> {
    const node = {
      id: this.id,
      type: this.type,
      configuration: this.configuration as OriginalInputValues,
    };

    if (this.type !== "fn") return [node];

    const scope = new Scope({ declaringScope: this.#scope, serialize: true });

    const describe = this.#getHandlerDescribe(scope);
    const { inputSchema, outputSchema } = describe
      ? await describe()
      : { inputSchema: undefined, outputSchema: undefined };

    const graph = await scope.asScopeFor(async () => {
      try {
        const handler = this.#getHandlerFunction(
          scope
        ) as unknown as NodeHandlerFunction<I, O>;

        const inputNode = new NodeImpl<InputValues, I>(
          "input",
          scope,
          inputSchema ? { schema: inputSchema } : {}
        );
        // TODO: Had to set type to InputValues instead of
        // `O & { schema: Schema }` because of a typescript.
        // I don't know why. I should fix this.
        const outputNode = new NodeImpl<InputValues, O>(
          "output",
          scope,
          outputSchema ? { schema: outputSchema } : {}
        );

        const resultOrPromise = handler(inputNode.asProxy(), this);

        // Support both async and sync handlers. Sync handlers should in
        // practice only be used to statically create graphs (as reading inputs
        // requires async await and all other nodes should do work on their
        // inputs or maybe otherwise await external signals)
        let result =
          resultOrPromise instanceof Promise
            ? await resultOrPromise
            : resultOrPromise;

        // await flattens Promises, so a handler returning a NodeImpl will
        // actually return a TrapResult, as its `then` method will be called. At
        // most one is created per serializing scope, so we now that this must
        // be the one.
        if (TrapResult.isTrapResult(result))
          result = TrapResult.getNode(result);
        // If a trap result was generated, but not returned, then we must assume
        // some processing, i.e. not statically graph generating, and the
        // function must be serialized.
        else if (this.#scope.didTrapResultTrigger()) return null;

        let actualOutput = outputNode as NodeImpl;
        if (result instanceof NodeImpl) {
          const node = (result as NodeImpl).unProxy();
          // If the handler returned an output node, serialize it directly,
          // otherwise connect the returned node's outputs to the output node.
          if (node.type === "output") actualOutput = node;
          else outputNode.addInputsFromNode(node);
        } else {
          // Otherwise wire up all keys of the returned object to the output.
          const output = result as InputsMaybeAsValues<O>;

          // TODO: Refactor to merge with similar code in constructor
          let anyNonConstants = false;
          Object.keys(result as InputsMaybeAsValues<O>).forEach((key) =>
            isValue(output[key])
              ? (outputNode.addInputsFromNode(
                  ...(output[key] as Value).as(key).asNodeInput()
                ),
                (anyNonConstants = true))
              : output[key] instanceof NodeImpl
              ? (outputNode.addInputsFromNode(output[key] as NodeImpl, {
                  [key]: key,
                }),
                (anyNonConstants = true))
              : (outputNode.configuration[key as keyof OutputValues] = output[
                  key
                ] as (typeof outputNode.configuration)[keyof OutputValues])
          );

          // If all outputs are constants, then we didn't get a graph that
          // depends on its inputs. While this could indeed be a static node
          // that always returns the same value, we shouldn't assume for now
          // that it's deterministic, so we serialize it.
          if (!anyNonConstants) return null;
        }
        return scope.serialize(actualOutput);
      } catch (e) {
        if (e instanceof TrappedDataReadWhileSerializing) return null;
        else throw e;
      }
    })();

    // If we got a graph back, save it as a subgraph (returned as second value)
    // and turns this into an invoke node.
    if (graph) {
      node.type = "invoke";
      node.configuration = { ...node.configuration, graph: "#" + this.id };
      return [node, graph];
    }

    // Else, serialize the handler itself and return a runJavascript node.
    const fn =
      typeof this.#handler === "function"
        ? this.#handler
        : this.#handler?.invoke ?? "";
    let code = fn.toString() ?? ""; // The ?? is just for typescript
    let name = this.id.replace(/-/g, "_");

    const arrowFunctionRegex = /(?:async\s+)?(\w+|\([^)]*\))\s*=>\s*/;
    const traditionalFunctionRegex =
      /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/;

    if (arrowFunctionRegex.test(code)) {
      // It's an arrow function, convert to traditional
      code = code.replace(arrowFunctionRegex, (_, params) => {
        const async = code.trim().startsWith("async") ? "async " : "";
        const paramsWithParens = params.startsWith("(")
          ? params
          : `(${params})`;
        return `${async}function ${name}${paramsWithParens} `;
      });
    } else {
      const match = traditionalFunctionRegex.exec(code);
      if (match === null) throw new Error("Unexpected seralization: " + code);
      else name = match[1] || name;
    }

    node.type = "runJavascript";
    node.configuration = { ...node.configuration, code, name };

    return [node];
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
            target.#scope,
            prop
          );
          const method = target[prop as keyof NodeImpl<I, O>] as () => void;
          if (method && typeof method === "function") {
            return new Proxy(method.bind(target), {
              get(_, key, __) {
                return Reflect.get(value, key, value);
              },
              ownKeys(_) {
                return Reflect.ownKeys(value).filter(
                  (key) => typeof key === "string"
                );
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
    try {
      if (this.#scope.serializing())
        return Promise.resolve(this.#scope.createTrapResult(this)).then(
          onfulfilled && this.#scope.asScopeFor(onfulfilled),
          onrejected && this.#scope.asScopeFor(onrejected)
        );

      // It's ok to call this multiple times: If it already run it'll only do
      // something if new nodes or inputs were added (e.g. between await calls)
      this.#scope.invoke(this as unknown as NodeImpl);

      return this.#promise.then(
        onfulfilled && this.#scope.asScopeFor(onfulfilled),
        onrejected && this.#scope.asScopeFor(onrejected)
      );
    } catch (e) {
      if (onrejected)
        return Promise.reject(e).catch(this.#scope.asScopeFor(onrejected));
      else throw e;
    }
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
            this.#scope,
            config as Partial<O> & ToC
          );

    // TODO: Ideally we would look at the schema here and use * only if
    // the output is open ended and/or not all fields are present all the time.
    toNode.addInputsFromNode(this as unknown as NodeImpl, { "*": "*" });

    return (toNode as NodeImpl<O & ToC, ToO>).asProxy();
  }

  in(
    inputs:
      | NodeProxy<InputValues, Partial<I>>
      | InputsMaybeAsValues<I>
      | AbstractValue<NodeValue>
  ) {
    if (inputs instanceof NodeImpl) {
      const node = inputs as NodeImpl<InputValues, OutputValues>;
      this.addInputsFromNode(node);
    } else if (isValue(inputs)) {
      const value = inputs as Value;
      this.addInputsFromNode(...value.asNodeInput());
    } else {
      const values = inputs as InputsMaybeAsValues<I>;
      this.addInputsAsValues(values);
    }
    return this.asProxy();
  }

  as(keymap: KeyMap): Value {
    return new Value<NodeValue>(
      this as unknown as NodeImpl,
      this.#scope,
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
