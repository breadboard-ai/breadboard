/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  GraphDescriptor,
  GraphMetadata,
  NodeDescriptor,
  Edge,
  SubGraphs,
  Kit,
  KitConstructor,
  InputValues as OriginalInputValues,
  OutputValues as OriginalOutputValues,
  NodeFactory as OriginalNodeFactory,
  BoardRunner as OriginalBoardRunner,
  BreadboardRunner,
  BreadboardRunResult,
  NodeHandlerContext,
  BreadboardValidator,
  Schema,
  NodeDescriberFunction,
} from "@google-labs/breadboard";

// TODO:BASE: Same as before, but I added NodeFactory as base type, which is a
// way to encapsulate boards, including lambdas (instead of BoardCapability).
// Can keep it a capability, but this feels quite fundamental.
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

// TODO:BASE: This is pure syntactic sugar and should _not_ be moved
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

// TODO:BASE: Allowing inputs to be promises. In syntactic sugar this should
// actually be a NodeProxy on an input node (which looks like a promise).
export type NodeHandlerFunction<
  I extends InputValues,
  O extends OutputValues
> = (
  inputs: PromiseLike<I> & InputsMaybeAsValues<I>,
  node: NodeImpl<I, O>
) => InputsMaybeAsValues<O> | PromiseLike<O>;

// TODO:BASE: New: Allow handlers to accepts inputs as a promise.
// See also hack in handlersFromKit() below.
type NodeHandler<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> =
  | {
      invoke: NodeHandlerFunction<I, O>;
      describe?: NodeDescriberFunction;
    }
  | NodeHandlerFunction<I, O>; // Is assumed to accept promises

type NodeHandlers = Record<
  NodeTypeIdentifier,
  NodeHandler<InputValues, OutputValues>
>;

export type NodeFactory<I extends InputValues, O extends OutputValues> = (
  config?: NodeImpl<InputValues, I> | Value<NodeValue> | InputsMaybeAsValues<I>
) => NodeProxy<I, O>;

// TODO:BASE: This does two things
//   (1) register a handler with the scope
//   (2) create a factory function for the node type
// BASE should only be the first part, the second part should be in the syntax
export function addNodeType<I extends InputValues, O extends OutputValues>(
  name: string,
  handler: NodeHandler<I, O>
): NodeFactory<I, O> {
  getCurrentContextScope().addHandlers({
    [name]: handler as unknown as NodeHandler,
  });
  return ((config?: InputsMaybeAsValues<I>) => {
    return new NodeImpl(name, getCurrentContextScope(), config).asProxy();
  }) as unknown as NodeFactory<I, O>;
}

export interface Serializeable {
  serialize(
    metadata?: GraphMetadata
  ): Promise<GraphDescriptor> | GraphDescriptor;
}

/**
 * Creates a node factory for a node type that invokes a handler function. This
 * version infers the types from the function.
 *
 * The handler function can either return a graph (in which case it would be
 * serialized to a graph), or returns the results of a computation, called at
 * runtime and serialized as Javascript.
 *
 * @param fn Handler or graph creation function
 */
export function action<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
>(fn: NodeHandlerFunction<I, O>): NodeFactory<I, O> & Serializeable;

/**
 * Alternative version to above that infers the type of the passed in Zod type.
 *
 * @param options Object with at least `input`, `output` and `invoke` set
 */
export function action<I extends InputValues, O extends OutputValues>(options: {
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  invoke: NodeHandlerFunction<I, O>;
  describe?: NodeDescriberFunction;
  name?: string;
}): NodeFactory<I, O> & Serializeable;

/**
 * Same as above, but takes handler as a second parameter instead of as invoke
 * option. This looks a bit nicer in the code (less indentation).
 *
 * @param options `input` and `output` schemas
 * @param fn Handler function
 */
export function action<I extends InputValues, O extends OutputValues>(
  options: {
    input: z.ZodType<I>;
    output: z.ZodType<O>;
    describe?: NodeDescriberFunction;
    name?: string;
  },
  fn?: NodeHandlerFunction<I, O>
): NodeFactory<I, O> & Serializeable;

export function action<I extends InputValues, O extends OutputValues>(
  optionsOrFn:
    | {
        input: z.ZodType<I>;
        output: z.ZodType<O>;
        invoke?: NodeHandlerFunction<I, O>;
        describe?: NodeDescriberFunction;
        name?: string;
      }
    | NodeHandlerFunction<I, O>,
  fn?: NodeHandlerFunction<I, O>
): NodeFactory<I, O> & Serializeable {
  const options = typeof optionsOrFn === "function" ? undefined : optionsOrFn;
  if (!options) {
    fn = optionsOrFn as NodeHandlerFunction<I, O>;
  } else {
    if (options.invoke) fn = options.invoke;
    if (!fn) throw new Error("Missing invoke function");
  }
  const handler: NodeHandler<I, O> = {
    invoke: fn,
  };
  if (options) {
    handler.describe =
      options.describe ??
      (async () => {
        return {
          inputSchema: zodToSchema(options.input) as Schema,
          outputSchema: zodToSchema(options.output) as Schema,
        };
      });
  }
  const factory: NodeFactory<I, O> & Serializeable = addNodeType(
    options?.name ?? getNextNodeId("fn"),
    handler
  ) as NodeFactory<I, O> & Serializeable;
  factory.serialize = async (metadata?) => {
    // TODO: Schema isn't serialized right now
    // (as a function will be turned into a runJavascript node)
    const node = new NodeImpl(handler, getCurrentContextScope());
    const [singleNode, graph] = await node.serializeNode();
    // If there is a subgraph that is invoked, just return that.
    if (graph) return { ...metadata, ...graph } as GraphDescriptor;
    // Otherwise return the node, most likely a runJavascript node.
    else return { ...metadata, edges: [], nodes: [singleNode] };
  };
  return factory;
}

/**
 * This post processed JSON schema generated from Zod:
 *  - adds a title to the schema or any field by parsing the description as
 *    `${title}: ${description}`
 *  - removes $schema field
 *
 * @param zod Zod schema
 * @returns Post processed `Schema` object
 */
function zodToSchema(zod: z.ZodType<unknown>): Schema {
  const schema = zodToJsonSchema(zod) as Schema & { $schema?: string };
  delete schema.$schema;

  // Recursively visit all fields and add titles from descriptions
  const addTitles = (schema: Schema) => {
    if (schema.description) {
      const [title, description] = schema.description.split(":", 2);
      schema.title = title.trim();
      schema.description = description.trim();
    }
    if (schema.properties)
      Object.values(schema.properties).forEach((property) =>
        addTitles(property)
      );
  };

  addTitles(schema);

  return schema;
}

// TODO:BASE: This is wraps classic handlers that expected resolved inputs
// into something that accepts promises. We should either change all handlers
// to support promises or add a flag or something to support either mode.
// (Almost all handlers will immediately await, so it's a bit of a pain...)
function handlersFromKit(kit: Kit): NodeHandlers {
  return Object.fromEntries(
    Object.entries(kit.handlers).map(([name, handler]) => {
      const handlerFunction =
        handler instanceof Function ? handler : handler.invoke;
      return [
        name,
        {
          invoke: async (inputs) => {
            return handlerFunction(
              (await inputs) as OriginalInputValues,
              {}
            ) as Promise<OutputValues>;
          },
        },
      ];
    })
  );
}

// Extracts handlers from kits and creates node factorie for them.
export function addKit<T extends Kit>(
  ctr: KitConstructor<T>,
  namespacePrefix = ""
): { [key: string]: NodeFactory<InputValues, OutputValues> } {
  const kit = new ctr({} as unknown as OriginalNodeFactory);
  const handlers = handlersFromKit(kit);
  const removeNamespacePrefix = namespacePrefix
    ? (name: string) => {
        return name.startsWith(namespacePrefix)
          ? name.slice(namespacePrefix.length)
          : name;
      }
    : (name: string) => name;
  return Object.fromEntries(
    Object.entries(handlers).map(([name, handler]) => [
      removeNamespacePrefix(name),
      addNodeType(name, handler),
    ])
  );
}

// TODO:BASE This is almost `Edge`, except that it's references to nodes and not
// node ids. Also optional is missing.
export interface EdgeImpl<
  FromI extends InputValues = InputValues,
  FromO extends OutputValues = OutputValues,
  ToI extends InputValues = InputValues,
  ToO extends OutputValues = OutputValues
> {
  from: NodeImpl<FromI, FromO>;
  to: NodeImpl<ToI, ToO>;
  out: string;
  in: string;
  constant?: boolean;
}

// TODO:BASE: Decide whether this is part of the base or each syntactic layer
// needs to figure out how to assign ids.
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
export type NodeProxy<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> = {
  [K in keyof O]: Value<O[K]> & ((...args: unknown[]) => unknown);
} & {
  [key in string]: Value<NodeValue> & ((...args: unknown[]) => unknown);
} & NodeProxyInterface<I, O>;

type KeyMap = { [key: string]: string };

// TODO:BASE Extract base class that isn't opinioanted about the syntax. Marking
// methods that should be base as "TODO:BASE" below, including complications.
class NodeImpl<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> implements NodeProxyInterface<I, O>, PromiseLike<O>, Serializeable
{
  id: string;
  type: string;
  outgoing: EdgeImpl[] = [];
  incoming: EdgeImpl[] = [];
  configuration: Partial<I> = {};

  #handler?: NodeHandler<InputValues, OutputValues>;

  #promise: Promise<O>;
  #resolve?: (value: O | PromiseLike<O>) => void;
  #reject?: (reason?: unknown) => void;

  #inputs: Partial<I>;
  #constants: Partial<I> = {};
  #incomingEmptyWires: NodeImpl[] = [];
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
    config: (Partial<InputsMaybeAsValues<I>> | Value<NodeValue>) & {
      $id?: string;
    } = {}
  ) {
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

    this.id = id || getNextNodeId(this.type);

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

      const edge: EdgeImpl = {
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

        const edge: EdgeImpl = {
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
  receiveInputs(edge: EdgeImpl, inputs: InputValues) {
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
      | Value<NodeValue>
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

// Because Value is sometimes behind a function Proxy (see above, for NodeImpl's
// methods), we need to use this approach to identify Value instead instanceof.
export const IsValueSymbol = Symbol("IsValue");

function isValue<T extends NodeValue = NodeValue>(
  obj: unknown
): Value<T> | false {
  return (
    typeof obj === "object" &&
    (obj as unknown as { [key: symbol]: boolean })[IsValueSymbol] &&
    (obj as unknown as Value<T>)
  );
}

class Value<T extends NodeValue = NodeValue>
  implements PromiseLike<T | undefined>
{
  #node: NodeImpl<InputValues, OutputValue<T>>;
  #scope: Scope;
  #keymap: KeyMap;
  #constant: boolean;

  constructor(
    node: NodeImpl<InputValues, OutputValue<T>>,
    scope: Scope,
    keymap: string | KeyMap,
    constant = false
  ) {
    this.#node = node;
    this.#scope = scope;
    this.#keymap = typeof keymap === "string" ? { [keymap]: keymap } : keymap;
    (this as unknown as { [key: symbol]: Value<T> })[IsValueSymbol] = this;
    this.#constant = constant;
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
        this.#scope.asScopeFor(onfulfilled)(o[Object.keys(this.#keymap)[0]]),
      onrejected && this.#scope.asScopeFor(onrejected)
    ) as PromiseLike<TResult1 | TResult2>;
  }

  asNodeInput(): [
    NodeImpl<InputValues, OutputValues>,
    { [key: string]: string },
    constant: boolean
  ] {
    return [
      this.#node.unProxy() as NodeImpl<InputValues, OutputValues>,
      this.#keymap,
      this.#constant,
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
  ): NodeProxy<OutputValue<T> & ToC, ToO> {
    const toNode =
      to instanceof NodeImpl
        ? to.unProxy()
        : new NodeImpl(
            to as NodeTypeIdentifier | NodeHandler<OutputValue<T> & ToC, ToO>,
            this.#scope,
            config as OutputValue<T> & ToC
          );

    toNode.addInputsFromNode(
      this.#node as unknown as NodeImpl,
      this.#keymap,
      this.#constant
    );

    return (toNode as NodeImpl<OutputValue<T> & ToC, ToO>).asProxy();
  }

  // TODO: Double check this, as it's acting on output types, not input types.
  in(inputs: NodeImpl<InputValues, OutputValues> | InputValues) {
    if (inputs instanceof NodeImpl || isValue(inputs)) {
      let invertedMap = Object.fromEntries(
        Object.entries(this.#keymap).map(([fromKey, toKey]) => [toKey, fromKey])
      );
      const asValue = isValue(inputs);
      if (asValue) {
        invertedMap = asValue.#remapKeys(invertedMap);
        this.#node.addInputsFromNode(asValue.#node, invertedMap);
      } else {
        this.#node.addInputsFromNode(inputs as NodeImpl, invertedMap);
      }
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

    return new Value(this.#node, this.#scope, newMap, this.#constant);
  }

  memoize() {
    return new Value(this.#node, this.#scope, this.#keymap, true);
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

/**
 * During serialization, these will be returned on `await` on a node. If the
 * code accesses a field, it will throw an `AwaitWhileSerializing`.
 *
 * That way when an awaited async handler function returns a node, and it will
 * be returned as TrapResult, which we remember in the scope.
 *
 * But if the function itself awaits a node and reads the results, it will throw
 * an exception.
 *
 * If the function itself awaits a node and for some reason doesn't do anything
 * with it (otherwise it would trigger the exception), and returns a different
 * value or node, we'll detect that by seeing that TrapResult was set, but was
 * not returned. Such a handler function should be serialized.
 *
 * If the function doesn't return either a value or a node, i.e. just a constant
 * value, we'll for now assume that it's a non-deterministic function whose
 * output doesn't depend on the inputs and serialize it (a node that returns
 * pure values but does read from the inputs would trigger the condition above).
 *
 * TODO: Eventually though, that last case should throw an error, as all
 * external calls should be explicit (e.g. using a fetch node).
 */
const trapResultSymbol = Symbol("TrapResult");

class TrapResult<I extends InputValues, O extends OutputValues> {
  [trapResultSymbol]: NodeImpl<I, O>;

  constructor(public node: NodeImpl<I, O>) {
    this[trapResultSymbol] = node;
    return new Proxy(this, {
      get: (target, prop) => {
        // `then` because await checks whether this is a thenable (it should
        // fail). NOTE: Code that uses as an output wire called `await` will now
        // not trigger the trap. That's why there is a then symbol: Increasing
        // the chances that we get some weird error anyway. TODO: Improve.
        if (typeof prop === "symbol" || prop === "then")
          return Reflect.get(target, prop);
        throw new TrappedDataReadWhileSerializing();
      },
    });
  }

  then = Symbol("then");

  // Use this instead of `instanceof`.
  static isTrapResult<I extends InputValues, O extends OutputValues>(
    trapResult: TrapResult<I, O>
  ) {
    return trapResult[trapResultSymbol] !== undefined;
  }

  // This is used to get the underlying node despite the proxy above.
  static getNode<I extends InputValues, O extends OutputValues>(
    trapResult: TrapResult<I, O>
  ) {
    return trapResult[trapResultSymbol];
  }
}

class TrappedDataReadWhileSerializing {}

// TODO:BASE Maybe this should really be "Scope"?
export class Scope {
  #declaringScope?: Scope;
  #invokingScope?: Scope;
  #isSerializing: boolean;
  #probe?: EventTarget;

  #handlers: NodeHandlers = {};

  #trapResultTriggered = false;

  // TODO:BASE, config of subclasses can have more fields
  constructor(
    config: {
      declaringScope?: Scope;
      invokingScope?: Scope;
      serialize?: boolean;
      probe?: EventTarget;
    } = {}
  ) {
    this.#declaringScope = config.declaringScope;
    this.#invokingScope = config.invokingScope;
    this.#isSerializing = config.serialize ?? false;
    this.#probe = config.probe;
  }

  // TODO:BASE
  addHandlers(handlers: NodeHandlers) {
    Object.entries(handlers).forEach(
      ([name, handler]) => (this.#handlers[name] = handler)
    );
  }

  // TODO:BASE
  /**
   * Finds handler by name
   *
   * Scans up the parent chain if not found in this scope, looking in calling
   * scopes before the declaration context scopes.
   *
   * That is, if a graph is invoked with a specific set of kits, then those kits
   * have precedence over kits declared when building the graphs. And kits
   * declared by invoking graphs downstream have precedence over those declared
   * upstream.
   *
   * @param name Name of the handler to retrieve
   * @returns Handler or undefined
   */
  getHandler<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues
  >(name: string): NodeHandler<I, O> | undefined {
    return (this.#handlers[name] ||
      this.#invokingScope?.getHandler(name) ||
      this.#declaringScope?.getHandler(name)) as unknown as NodeHandler<I, O>;
  }

  /**
   * Swap global scope with this one, run the function, then restore
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  asScopeFor<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: unknown[]) => {
      const oldScope = swapCurrentContextScope(this);
      try {
        return fn(...args);
      } finally {
        swapCurrentContextScope(oldScope);
      }
    }) as T;
  }

  createTrapResult<I extends InputValues, O extends OutputValues>(
    node: NodeImpl<I, O>
  ): O {
    if (!this.#isSerializing)
      throw new Error("Can't create fake result outside of serialization");

    // We expect at most one trap - the one for the final result - in a
    // statically graph generating handler function.
    if (this.#trapResultTriggered) throw new TrappedDataReadWhileSerializing();
    this.#trapResultTriggered = true;

    return new TrapResult(node) as unknown as O;
  }

  didTrapResultTrigger() {
    return this.#trapResultTriggered;
  }

  // TODO:BASE - and really this should implement .run() and .runOnce()
  async invoke(node: NodeImpl) {
    const queue: NodeImpl[] = this.#findAllConnectedNodes(node).filter(
      (node) => !node.missingInputs()
    );

    const lastNodeDetails = new Map<string, object>();
    let lastNode: object | undefined = undefined;
    while (queue.length) {
      const node = queue.shift() as NodeImpl;

      // Send beforeHandler event
      const beforeHandlerDetail = {
        descriptor: {
          id: node.id,
          type: node.type,
          configuration: node.configuration,
        } as NodeDescriptor,
        inputs: node.getInputs() as OriginalInputValues,
        outputs: Promise.resolve({}),
      };
      const shouldInvokeHandler =
        !this.#probe ||
        this.#probe?.dispatchEvent(
          // Using CustomEvent instead of ProbeEvent because not enough types
          // are currently exported by breadboard, and I didn't want to change
          // too much while prototyping. TODO: Fix this.
          new CustomEvent("beforehandler", {
            detail: beforeHandlerDetail,
            cancelable: true,
          })
        );

      // Invoke node, unless beforeHandler event was cancelled.
      const result = shouldInvokeHandler
        ? await node.invoke(this)
        : ((await beforeHandlerDetail.outputs) as OutputValues);

      // Distribute data to outgoing edges
      const receivingNodes: { [key: string]: string[] } = {};
      const unusedKeys = new Set<string>(Object.keys(result));
      const incompleteNodes: {
        node: string;
        missing: string[];
      }[] = [];
      node.outgoing.forEach((edge) => {
        const ports = edge.to.receiveInputs(edge, result);
        receivingNodes[edge.to.id] = ports;
        ports.forEach((key) => unusedKeys.delete(key));

        // If it's ready to run, add it to the queue
        const missing = edge.to.missingInputs();
        if (!missing) queue.push(edge.to);
        else
          incompleteNodes.push({
            node: edge.to.id,
            missing,
          });
      });

      // Send node event with the results
      const probeDetails = {
        ...beforeHandlerDetail,
        outputs: result,
        receivingNodes,
        incompleteNodes,
        unusedKeys: [...unusedKeys],
      };
      this.#probe?.dispatchEvent(
        new CustomEvent("node", { detail: probeDetails })
      );

      // Keep track of the last run of any node with incomplete next nodes
      if (probeDetails.incompleteNodes.length > 0)
        lastNodeDetails.set(node.id, probeDetails);
      else lastNodeDetails.delete(node.id);

      lastNode = probeDetails;
    }

    // For convenience, send a done event with the last node's details. In a
    // developer tool, this could be highlighted if the last node wasn't
    // expected, e.g. not an output node, and it might point out where the graph
    // got stuck.
    this.#probe?.dispatchEvent(
      new CustomEvent("done", {
        detail: {
          last: lastNode,
          incompleteNextNodes: [...lastNodeDetails.values()],
        },
      })
    );
  }

  // TODO:BASE, should be complete.
  async serialize(
    node: NodeImpl,
    metadata?: GraphMetadata
  ): Promise<GraphDescriptor> {
    const queue: NodeImpl[] = this.#findAllConnectedNodes(node);

    const graphs: SubGraphs = {};

    const nodes = await Promise.all(
      queue.map(async (node) => {
        const [nodeDescriptor, subGraph] = await node.serializeNode();
        if (subGraph) graphs[node.id] = subGraph;
        return nodeDescriptor;
      })
    );

    const edges = queue.flatMap((node) =>
      node.outgoing.map((edge) => ({
        from: edge.from.id,
        to: edge.to.id,
        out: edge.out,
        in: edge.in,
        ...(edge.constant ? { constant: true } : {}),
      }))
    );

    return { ...metadata, edges, nodes, graphs };
  }

  // TODO:BASE, this is needed for our syntax so that it can call handlers in
  // serialization mode. Should this be part of the base class? Probably not.
  serializing() {
    return this.#isSerializing;
  }

  #findAllConnectedNodes(node: NodeImpl) {
    const nodes = new Set<NodeImpl>();
    const queue = [node.unProxy()];

    while (queue.length) {
      const node = queue.shift() as NodeImpl;
      if (nodes.has(node)) continue;
      nodes.add(node);
      node.incoming.forEach((edge) => queue.push(edge.from.unProxy()));
      node.outgoing.forEach((edge) => queue.push(edge.to.unProxy()));
    }

    return [...nodes];
  }
}

/**
 * Implements the current API, so that we can run in existing Breadboard
 * environments.
 */
export class BoardRunner implements BreadboardRunner {
  kits: Kit[] = []; // No-op for now
  edges: Edge[] = [];
  nodes: NodeDescriptor[] = [];
  args?: OriginalInputValues;

  #scope: Scope;
  #anyNode?: NodeImpl;

  constructor() {
    // Initial Scope is from call context of where the board is created
    this.#scope = new Scope({ declaringScope: getCurrentContextScope() });
  }

  async *run({
    probe,
    kits,
  }: NodeHandlerContext): AsyncGenerator<BreadboardRunResult> {
    if (!this.#anyNode)
      throw new Error("Can't run board without any nodes in it");

    const scope = new Scope({
      declaringScope: this.#scope,
      invokingScope: getCurrentContextScope(),
      probe,
    });

    let streamController: ReadableStreamDefaultController<BreadboardRunResult>;
    const stream = new ReadableStream<BreadboardRunResult>({
      start(controller) {
        streamController = controller;
      },
    });

    scope.addHandlers({
      input: async (inputs: InputsMaybeAsValues<InputValues>, node) => {
        let resolver: (outputs: OutputValues) => void;
        const outputsPromise = new Promise<OutputValues>((resolve) => {
          resolver = resolve;
        });
        const descriptor = { type: node.type, id: node.id };
        const result = {
          type: "input",
          node: descriptor,
          inputArguments: inputs as OriginalInputValues,
          set inputs(inputs: OriginalInputValues) {
            resolver(inputs as OutputValues);
          },
          state: { skip: false } as unknown as BreadboardRunResult["state"],
        } as BreadboardRunResult;
        streamController.enqueue(result);
        outputsPromise.then((result) =>
          probe?.dispatchEvent(
            new CustomEvent("input", {
              detail: { descriptor, inputs, outputs: result },
            })
          )
        );
        return outputsPromise as Promise<OutputValues>;
      },
      output: async (inputs: InputsMaybeAsValues<InputValues>, node) => {
        const descriptor = { type: node.type, id: node.id };
        const result = {
          type: "output",
          node: descriptor,
          outputs: inputs as OriginalInputValues,
          state: { skip: false } as unknown as BreadboardRunResult["state"],
        } as BreadboardRunResult;
        probe?.dispatchEvent(
          new CustomEvent("output", {
            detail: { descriptor, inputs },
            cancelable: true,
          })
        );
        streamController.enqueue(result);
        return {};
      },
    });

    kits?.forEach((kit) => scope.addHandlers(handlersFromKit(kit)));

    scope.invoke(this.#anyNode).then(() => streamController.close());

    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  }

  // This is mostly copy & pasted from the original
  async runOnce(
    inputs: OriginalInputValues,
    context?: NodeHandlerContext
  ): Promise<OriginalOutputValues> {
    const args = { ...inputs, ...this.args };

    try {
      let outputs: OriginalOutputValues = {};

      for await (const result of this.run(context ?? {})) {
        if (result.type === "input") {
          // Pass the inputs to the board. If there are inputs bound to the board
          // (e.g. from a lambda node that had incoming wires), they will
          // overwrite supplied inputs.
          result.inputs = args;
        } else if (result.type === "output") {
          outputs = result.outputs;
          // Exit once we receive the first output.
          break;
        }
      }
      return outputs;
    } catch (e) {
      // Unwrap unhandled error (handled errors are just outputs of the board!)
      if ((e as { cause: string }).cause)
        return Promise.resolve({
          $error: (e as { cause: string }).cause,
        } as OriginalOutputValues);
      else throw e;
    }
  }

  // To discuss: This is the same as runOnce() above, but implemented in
  // parallel to run(), using different (and very simple) proxied input and
  // output nodes.
  async runOnce2(
    inputs: OriginalInputValues,
    context?: NodeHandlerContext
  ): Promise<OriginalOutputValues> {
    if (!this.#anyNode)
      throw new Error("Can't run board without any nodes in it");

    const args = { ...inputs, ...this.args };

    const scope = new Scope({
      declaringScope: this.#scope,
      invokingScope: getCurrentContextScope(),
      probe: context?.probe,
    });

    context?.kits?.forEach((kit) => scope.addHandlers(handlersFromKit(kit)));

    let resolver: (outputs: OriginalOutputValues) => void;
    const promise = new Promise<OriginalOutputValues>((resolve) => {
      resolver = resolve;
    });

    scope.addHandlers({
      input: async () => {
        return args as InputValues;
      },
      output: async (inputs: InputsMaybeAsValues<InputValues>) => {
        resolver(inputs as OriginalOutputValues);
        return {};
      },
    });

    // TODO: One big difference to before: This will keep running forever, even
    // after the first output is encountered. We need to add a way to abort the
    // run.
    scope.invoke(this.#anyNode);

    return promise;
  }

  addValidator(_: BreadboardValidator): void {
    // TODO: Implement
  }

  static async fromNode(
    node: NodeImpl,
    metadata?: GraphMetadata
  ): Promise<BoardRunner> {
    const board = new BoardRunner();
    Object.assign(board, await node.serialize(metadata));
    board.#anyNode = node;
    return board;
  }

  static async fromGraphDescriptor(
    graph: GraphDescriptor
  ): Promise<BoardRunner> {
    const board = new BoardRunner();
    board.nodes = graph.nodes;
    board.edges = graph.edges;
    board.args = graph.args;

    const nodes = new Map<string, NodeImpl>();
    graph.nodes.forEach((node) => {
      const newNode = new NodeImpl(
        node.type,
        board.#scope,
        node.configuration as InputValues
      );
      nodes.set(node.id, newNode);
      if (!board.#anyNode) board.#anyNode = newNode;
    });

    graph.edges.forEach((edge) => {
      const newEdge = {
        from: nodes.get(edge.from),
        to: nodes.get(edge.to),
        out: edge.out,
        in: edge.in,
        constant: edge.constant,
      } as EdgeImpl;
      newEdge.from.outgoing.push(newEdge);
      newEdge.to.incoming.push(newEdge);
    });

    return board;
  }

  static async load(
    url: string,
    options?: {
      base?: string;
      outerGraph?: GraphDescriptor;
    }
  ): Promise<BoardRunner> {
    const graph = await OriginalBoardRunner.load(url, options);
    const board = await BoardRunner.fromGraphDescriptor(graph);
    return board;
  }
}

/**
 * The following is inspired by zone.js, but much simpler, and crucially doesn't
 * require monkey patching.
 *
 * Instead, we use a global variable to store the current scope, and swap it
 * out when we need to run a function in a different context.
 *
 * Scope.asScopeFor() wraps a function that runs with that Scope as context.
 *
 * action and any nodeFactory will run with the current Scope as context. That
 * is, they remember the Scope that was active when they were created.
 *
 * Crucially (and that's all we need from zone.js), {NodeImpl,Value}.then() call
 * onsuccessful and onrejected with the Scope as context. So even if the
 * context changed in the meantime, due to async calls, the rest of a flow
 * defining function will run with the current Scope as context.
 *
 * This works because NodeImpl and Value are PromiseLike, and so their then() is
 * called when they are awaited. Importantly, there is no context switch between
 * then() and the onsuccessful or onrejected call, if called from a Promise
 * then(), including a Promise.resolve().then (This makes it robust in case the
 * containing function isn't immediately awaited and so possibly Promises are
 * being scheduled). However, there is a context switch between the await and
 * the then() call, and so the context might have changed. That's why we
 * remember the scope on the node object.
 *
 * One requirement from this that there can't be any await in the body of a flow
 * or action function, if they are followed by either node creation or flow
 * calls. This is also a requirement for restoring state after interrupting a
 * flow.
 */

// Initialize with a default global Scope.
let currentContextScope = new Scope();

function getCurrentContextScope() {
  const scope = currentContextScope;
  if (!scope) throw Error("No scope found in context");
  return scope;
}

function swapCurrentContextScope(scope: Scope) {
  const oldScope = currentContextScope;
  currentContextScope = scope;
  return oldScope;
}

// Create the base kit:

const reservedWord: NodeHandlerFunction<
  InputValues,
  OutputValues
> = async () => {
  throw new Error("Reserved word handler should never be invoked");
};

function convertZodToSchemaInConfig<
  I extends InputValues,
  O extends OutputValues
>(
  config: { schema?: z.ZodType | Schema; $id?: string },
  factory: NodeFactory<I, O>
) {
  if (config.schema && config.schema instanceof z.ZodType) {
    config.schema = zodToSchema(config.schema);
  }
  return factory(config as Partial<I>);
}

// These get added to the default scope defined above
const inputFactory = addNodeType("input", reservedWord);
const outputFactory = addNodeType("output", reservedWord);

export const base = {
  input: (config: { schema?: z.ZodType | Schema; $id?: string }) =>
    convertZodToSchemaInConfig(config, inputFactory),
  output: (config: { schema?: z.ZodType | Schema; $id?: string }) =>
    convertZodToSchemaInConfig(config, outputFactory),
} as {
  input:
    | (<T extends OutputValues = OutputValues>(config: {
        schema: z.ZodObject<{ [K in keyof T]: z.ZodType<T[K]> }>;
        $id?: string;
      }) => NodeProxy<Record<string, never>, T>) &
        ((config: {
          schema?: Schema;
          $id?: string;
        }) => NodeProxy<Record<string, never>, OutputValues>);
  output: (<T extends InputValues>(
    config: {
      schema: z.ZodType<T>;
      $id?: string;
    } & Partial<{
      [K in keyof T]:
        | Value<T[K]>
        | NodeProxy<InputValues, OutputValue<T[K]>>
        | T[K];
    }>
  ) => NodeProxy<T, Record<string, never>>) &
    ((
      config: {
        schema?: Schema;
        $id?: string;
      } & InputsMaybeAsValues<InputValues>
    ) => NodeProxy<InputValues, Record<string, never>>);
};
