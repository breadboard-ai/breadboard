/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeDescriptor,
  InputValues as OriginalInputValues,
  Schema,
} from "@google-labs/breadboard";
import {
  InputsMaybeAsValues,
  NodeProxy,
  NodeProxyMethods,
  AbstractValue,
  BuilderNodeInterface,
  BuilderNodeConfig,
} from "./types.js";
import {
  InputValues,
  OutputValues,
  NodeHandler,
  NodeHandlerFunction,
  NodeTypeIdentifier,
  NodeValue,
  Serializeable,
  KeyMap,
  AbstractNode,
  OptionalIdConfiguration,
  ScopeInterface,
} from "../runner/types.js";

import { BaseNode } from "../runner/node.js";
import { BuilderScope } from "./scope.js";
import { TrapResult } from "./trap.js";
import { Value, isValue } from "./value.js";
import { isLambda } from "./recipe.js";

export class BuilderNode<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues
  >
  extends BaseNode<I, O>
  implements
    BuilderNodeInterface<I, O>,
    NodeProxyMethods<I, O>,
    PromiseLike<O>,
    Serializeable
{
  #promise: Promise<O>;
  #resolve?: (value: O | PromiseLike<O>) => void;
  #reject?: (reason?: unknown) => void;

  #scope: BuilderScope;
  #handler?: NodeHandler<I, O>;

  constructor(
    handler: NodeTypeIdentifier | NodeHandler<I, O>,
    scope: BuilderScope,
    config: BuilderNodeConfig<I> = {}
  ) {
    const nonProxyConfig: InputValues = {};
    if (
      !(config instanceof AbstractNode) &&
      !isBuilderNodeProxy(config) &&
      !isValue(config)
    ) {
      for (const [key, value] of Object.entries(config) as [
        [string, NodeValue | AbstractNode | Value]
      ]) {
        if (
          !(value instanceof AbstractNode) &&
          !isBuilderNodeProxy(config) &&
          !isValue(value) &&
          !isLambda(value)
        ) {
          nonProxyConfig[key as keyof InputValues] = value as NodeValue;
          delete config[key as keyof typeof config];
        }
      }
    }

    super(
      handler,
      scope,
      nonProxyConfig as Partial<I> & OptionalIdConfiguration
    );

    this.#scope = scope;

    if (typeof handler !== "string") this.#handler = handler;

    if (isBuilderNodeProxy(config)) {
      this.addInputsFromNode(config.unProxy());
    } else if (config instanceof AbstractNode) {
      this.addInputsFromNode(config);
    } else if (isLambda(config)) {
      this.addInputsAsValues({
        $recipe: config.getBoardCapabilityAsValue(),
      } as InputsMaybeAsValues<I>);
    } else if (isValue(config)) {
      this.addInputsFromNode(...config.asNodeInput());
    } else {
      this.addInputsAsValues(config as InputsMaybeAsValues<I>);
    }

    // Set up spread value, so that { ...node } as input works.
    (this as unknown as { [key: string]: BaseNode<I, O> })[this.#spreadKey()] =
      this;

    this.#promise = new Promise<O>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  addInputsAsValues(values: InputsMaybeAsValues<I>) {
    // Split into constants and nodes
    const constants: Partial<InputValues> = {};
    const nodes: [AbstractNode, KeyMap, boolean][] = [];

    Object.entries(values).forEach(([key, value]) => {
      // This turns something returned by recipe() into a BoardCapability, which
      // is going to be either a Promise for a BoardCapability (assigned to
      // constants below) or an AbstractValue to one.
      if (isLambda(value))
        value = value.getBoardCapabilityAsValue() as unknown as typeof value;

      if (isValue(value)) {
        nodes.push(value.as(key).asNodeInput());
      } else if (value instanceof AbstractNode || isBuilderNodeProxy(value)) {
        nodes.push([
          isBuilderNodeProxy(value) ? value.unProxy() : value,
          { [key]: key },
          false,
        ]);
      } else {
        constants[key] = value as NodeValue;
      }
    });

    this.receiveConstants(constants);
    nodes.forEach((node) => this.unProxy().addInputsFromNode(...node));
  }

  // Add inputs from another node as edges
  addInputsFromNode(
    from: AbstractNode,
    keymap: KeyMap = { "*": "" },
    constant?: boolean
  ) {
    const keyPairs = Object.entries(keymap);
    if (keyPairs.length === 0) {
      // Add an empty edge: Just control flow, no data moving.
      this.addIncomingEdge(from, "", "", constant);
    } else {
      keyPairs.forEach(([fromKey, toKey]) => {
        // "*-<id>" means "all outputs from <id>" and comes from using a node in
        // a spread, e.g. newNode({ ...node, $id: "id" }
        if (fromKey.startsWith("*-")) {
          fromKey = "*";
          toKey = "";
        }

        this.unProxy().addIncomingEdge(
          isBuilderNodeProxy(from) ? from.unProxy() : from,
          fromKey,
          toKey,
          constant
        );
      });
    }
  }

  // TODO:BASE: This should just be in the super class, below should become a
  // wrapper around it.
  #getHandlerFunction(scope: ScopeInterface) {
    const handler = this.#handler ?? scope.getHandler(this.type);
    if (!handler) throw new Error(`Handler ${this.type} not found`);
    return typeof handler === "function" ? handler : handler.invoke;
  }

  // TODO:BASE: In the end, we need to capture the outputs and resolve the
  // promise. But before that there is a bit of refactoring to do to allow
  // returning of graphs, parallel execution, etc.
  async invoke(dynamicScope?: ScopeInterface): Promise<O> {
    const scope = new BuilderScope({
      dynamicScope,
      lexicalScope: this.#scope,
    });
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
          this.getInputs() as PromiseLike<I> & I,
          this
        )) as O;

        // Execute graphs returned by the handler as individual results (A full
        // graph returned would have already been executed above)
        //
        // TODO: As a future feature, it would be nice to do this as deep
        // traversal, so that developers can return complex structures composed
        // of different responses. But only if we support this for regular nodes
        // as well.
        for (const [key, value] of Object.entries(result)) {
          if (value instanceof BuilderNode)
            result[key as keyof O] = (await value)[key];
          else if (isValue(value))
            result[key as keyof O] = (await value) as O[keyof O];
          else if (isLambda(value))
            result[key as keyof O] =
              (await value.getBoardCapabilityAsValue()) as O[keyof O];
        }

        // Resolve promise, but only on first run
        if (this.#resolve) {
          this.#resolve(result);
          this.#resolve = this.#reject = undefined;
        }

        this.setOutputs(result);

        return result;
      } catch (e) {
        // Reject promise, but only on first run
        if (this.#reject) {
          this.#reject(e);
          this.#resolve = this.#reject = undefined;
        }
        throw e;
      }
    })();
  }

  // TODO:BASE Special casing the function case (which is most of the code
  // here), everything else is the same, but really just the first few lines
  // here.
  async serializeNode(): Promise<[NodeDescriptor, GraphDescriptor?]> {
    if (this.type !== "fn") {
      // HACK: See recipe.getClosureNode() for why this is needed. There we
      // create a node that has a board capability as input, but serializing the
      // graph is async, while node creation isn't. So we wait until here to
      // await the serialized BoardCapability. To fix: Make node factories a
      // first class object, which should inherently move serializing the
      // subgraph to here (and never serialize subgraphs if their parent graphs
      // aren't serialized either).
      for (const [key, value] of Object.entries(this.configuration)) {
        if (value instanceof Promise) {
          this.configuration[key as keyof typeof this.configuration] =
            await value;
        }
      }
      return super.serializeNode();
    }

    const scope = new BuilderScope({
      lexicalScope: this.#scope,
      serialize: true,
    });

    const handler = this.#getHandlerFunction(
      scope
    ) as unknown as NodeHandlerFunction<I, O>;

    const schemas = await this.describe(scope);

    const graph = await scope.asScopeFor(async () => {
      try {
        const inputNode = new BuilderNode<InputValues, I>(
          "input",
          scope,
          schemas ? { schema: schemas.inputSchema } : {}
        );
        const outputNode = new BuilderNode<O & { schema?: Schema }, O>(
          "output",
          scope,
          (schemas ? { schema: schemas.outputSchema } : {}) as Partial<
            O & { schema?: Schema }
          >
        );

        const resultOrPromise = handler(
          inputNode.asProxy() as unknown as I & PromiseLike<I>,
          this
        );

        // Support both async and sync handlers. Sync handlers should in
        // practice only be used to statically create graphs (as reading inputs
        // requires async await and all other nodes should do work on their
        // inputs or maybe otherwise await external signals)
        let result =
          resultOrPromise instanceof Promise
            ? await resultOrPromise
            : resultOrPromise;

        // await flattens Promises, so a handler returning a BuilderNode will
        // actually return a TrapResult, as its `then` method will be called. At
        // most one is created per serializing scope, so we now that this must
        // be the one.
        if (TrapResult.isTrapResult(result))
          result = TrapResult.getNode(result);
        // If a trap result was generated, but not returned, then we must assume
        // some processing, i.e. not statically graph generating, and the
        // function must be serialized.
        else if (scope.didTrapResultTrigger()) return null;

        let actualOutput = outputNode as BuilderNode<O, O>;
        if (result instanceof BuilderNode) {
          const node = result.unProxy();
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
              : output[key] instanceof AbstractNode
              ? (outputNode.addInputsFromNode(output[key] as BuilderNode, {
                  [key]: key,
                }),
                (anyNonConstants = true))
              : (outputNode.configuration[key as keyof O] = output[
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
        return null;
      }
    })();

    // If we got a graph back, save it as a subgraph (returned as second value)
    // and turns this into an invoke node.
    if (graph) {
      const node: NodeDescriptor = {
        id: this.id,
        type: "invoke",
        configuration: {
          ...(this.configuration as OriginalInputValues),
          path: "#" + this.id,
        },
      };

      return [node, graph];
    }

    // Else, serialize the handler itself and return a runJavascript node.
    let code = handler.toString();
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

    const invokeGraph: GraphDescriptor = {
      edges: [
        { from: `${this.id}-input`, to: `${this.id}-run`, out: "*" },
        { from: `${this.id}-run`, to: `${this.id}-output`, out: "*" },
      ],
      nodes: [
        {
          id: `${this.id}-input`,
          type: "input",
          configuration: schemas?.inputSchema
            ? { schema: schemas.inputSchema }
            : {},
        },
        {
          id: `${this.id}-run`,
          type: "runJavascript",
          configuration: {
            ...(this.configuration as OriginalInputValues),
            code,
            name,
            raw: true,
          },
        },
        {
          id: `${this.id}-output`,
          type: "output",
          configuration: schemas?.outputSchema
            ? { schema: schemas.outputSchema }
            : {},
        },
      ],
    };

    const node = {
      id: this.id,
      type: "invoke",
      configuration: { path: "#" + this.id },
    };

    return [node, invokeGraph];
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
            target as unknown as BuilderNode<InputValues, OutputValues>,
            target.#scope as BuilderScope,
            prop
          );

          let method = target[prop as keyof BuilderNode<I, O>] as () => void;
          // .to(), .in(), etc. call the original method:
          if (method && typeof method === "function")
            method = method.bind(target);
          // Otherwise, default "method" is to invoke the lambda represented by the value
          else
            method = ((config?: BuilderNodeConfig) =>
              value.invoke(config)).bind(value);

          return new Proxy(method, {
            get(_, key, __) {
              const maybeMethod = Reflect.get(value, key, value);
              return typeof maybeMethod === "function"
                ? maybeMethod.bind(value)
                : maybeMethod;
            },
            ownKeys(_) {
              return Reflect.ownKeys(value).filter(
                (key) => typeof key === "string"
              );
            },
          });
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
   * if (thing instanceof BuilderNode) { const node = thing.unProxy(); }
   *
   * @returns A BuilderNoder that is not a proxy, but the original BuilderNode.
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
      this.#scope.invoke(this as unknown as BaseNode);

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
    const toNode = isBuilderNodeProxy(to)
      ? to.unProxy()
      : new BuilderNode(
          to as NodeTypeIdentifier | NodeHandler<Partial<O> & ToC, ToO>,
          this.#scope,
          config as Partial<O> & ToC
        );

    // TODO: Ideally we would look at the schema here and use * only if
    // the output is open ended and/or not all fields are present all the time.
    toNode.addInputsFromNode(this as unknown as BaseNode, { "*": "" });

    return (toNode as BuilderNode<O & ToC, ToO>).asProxy();
  }

  // This doesn't do any type checking on the inputs.
  //
  // TODO: See whether that's somehow possible. The main problem is that
  // node.<field> is typed for the outputs. We could add a new InputValue type
  // and generate those from node.in().field so that the final syntax could be
  // - `toNode.in({ toField: fromNode.in().fromField) }` or
  // - `toNode.in({ field: fromNode.in() })`
  //
  // That is, today .in() returns itself, and in with this change, it would
  // return a proxy object typed with the input types.
  in(
    inputs:
      | NodeProxy<InputValues, Partial<I>>
      | InputsMaybeAsValues<I>
      | AbstractValue<NodeValue>
  ) {
    if (inputs instanceof BaseNode) {
      this.addInputsFromNode(inputs);
    } else if (isValue(inputs)) {
      this.addInputsFromNode(...inputs.asNodeInput());
    } else {
      this.addInputsAsValues(inputs as InputsMaybeAsValues<I>);
    }
    return this.asProxy();
  }

  as(keymap: KeyMap): Value {
    return new Value<NodeValue>(
      this as unknown as BuilderNode,
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

// This will also match Lambdas, since they behave like a subset of
// BuilderNodeProxy.
//
// TODO: Identify where they don't and possibly use a different is* there.
export function isBuilderNodeProxy<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
>(node: unknown): node is BuilderNodeInterface<I, O> {
  return typeof (node as BuilderNodeInterface<I, O>).unProxy === "function";
}
