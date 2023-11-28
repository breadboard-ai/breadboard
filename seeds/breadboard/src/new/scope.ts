import {
  GraphDescriptor,
  GraphMetadata,
  SubGraphs,
} from "@google-labs/breadboard";
import {
  InputValues,
  OutputValues,
  NodeHandler,
  NodeHandlers,
  AbstractNode,
  ScopeInterface,
  InvokeCallbacks,
  OutputDistribution,
  DeclaringScopeInterface as BuilderScopeInterface,
  BuilderNodeInterface,
} from "./types.js";

import { swapCurrentContextScope } from "./default-scope.js";
import { BuilderNode, BaseNode } from "./node.js";
import { TrappedDataReadWhileSerializing, TrapResult } from "./trap.js";

export interface ScopeConfig {
  declaringScope?: ScopeInterface;
  invokingScope?: ScopeInterface;
}

export class Scope implements ScopeInterface {
  #declaringScope?: ScopeInterface;
  #invokingScope?: ScopeInterface;

  #handlers: NodeHandlers = {};

  constructor(config: ScopeConfig = {}) {
    this.#declaringScope = config.declaringScope;
    this.#invokingScope = config.invokingScope;
  }

  addHandlers(handlers: NodeHandlers) {
    Object.entries(handlers).forEach(
      ([name, handler]) => (this.#handlers[name] = handler)
    );
  }

  getHandler<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues
  >(name: string): NodeHandler<I, O> | undefined {
    return (this.#handlers[name] ||
      this.#invokingScope?.getHandler(name) ||
      this.#declaringScope?.getHandler(name)) as unknown as NodeHandler<I, O>;
  }

  async invoke(node: AbstractNode, callbacks: InvokeCallbacks[] = []) {
    try {
      const queue: AbstractNode[] = this.#findAllConnectedNodes(node).filter(
        (node) => !node.missingInputs()
      );

      while (queue.length) {
        const node = queue.shift() as AbstractNode;

        const inputs = node.getInputs();

        let callbackResult: OutputValues | undefined = undefined;
        for (const callback of callbacks) {
          callbackResult = await callback.before?.(node, inputs);
          if (callbackResult) break;
        }

        // Invoke node, unless before callback already provided a result.
        const result =
          callbackResult ??
          (await node.invoke(this).catch((e) => {
            return {
              $error: {
                type: "error",
                error: e,
              },
            };
          }));

        // Distribute data to outgoing edges
        const unusedPorts = new Set<string>(Object.keys(result));
        const distribution: OutputDistribution = { nodes: [], unused: [] };
        node.outgoing.forEach((edge) => {
          const ports = edge.to.receiveInputs(edge, result);
          ports.forEach((key) => unusedPorts.delete(key));

          // If it's ready to run, add it to the queue
          const missing = edge.to.missingInputs();
          if (!missing) queue.push(edge.to);

          distribution.nodes.push({ node: edge.to, received: ports, missing });
        });

        // Call after callback
        distribution.unused = [...unusedPorts];
        for (const callback of callbacks) {
          await callback.after?.(node, inputs, result, distribution);
        }

        // Abort graph on uncaught errors.
        if (unusedPorts.has("$error")) {
          throw (result["$error"] as { error: Error }).error;
        }
      }
    } finally {
      // Call done callback
      for (const callback of callbacks) {
        await callback.done?.();
      }
    }
  }

  async serialize(
    node: AbstractNode,
    metadata?: GraphMetadata
  ): Promise<GraphDescriptor> {
    const queue: AbstractNode[] = this.#findAllConnectedNodes(node);

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

  #findAllConnectedNodes(node: AbstractNode) {
    const nodes = new Set<AbstractNode>();
    const queue = [node];

    while (queue.length) {
      const node = queue.shift() as AbstractNode;
      if (nodes.has(node)) continue;
      nodes.add(node);
      node.incoming.forEach((edge) => queue.push(edge.from));
      node.outgoing.forEach((edge) => queue.push(edge.to));
    }

    return [...nodes];
  }
}

/**
 * Adds syntactic sugar to support unproxying and serialization of nodes/graphs.
 */
export class BuilderScope extends Scope implements BuilderScopeInterface {
  #isSerializing: boolean;

  #trapResultTriggered = false;

  // TODO:BASE, config of subclasses can have more fields
  constructor(
    config: ScopeConfig & {
      serialize?: boolean;
    } = {}
  ) {
    super(config);
    this.#isSerializing = config.serialize ?? false;
  }

  async serialize(
    node: AbstractNode,
    metadata?: GraphMetadata
  ): Promise<GraphDescriptor> {
    return super.serialize(
      typeof (node as BuilderNodeInterface).unProxy === "function"
        ? (node as BuilderNodeInterface).unProxy()
        : node,
      metadata
    );
  }

  serializing() {
    return this.#isSerializing;
  }

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
    node: AbstractNode<I, O>
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
}
