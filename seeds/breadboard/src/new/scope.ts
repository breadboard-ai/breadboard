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
} from "./types.js";
import { swapCurrentContextScope } from "./default-scope.js";
import { NodeImpl } from "./node.js";
import { TrappedDataReadWhileSerializing, TrapResult } from "./trap.js";

// TODO:BASE Maybe this should really be "Scope"?

export class Scope implements ScopeInterface {
  #declaringScope?: Scope;
  #invokingScope?: Scope;
  #isSerializing: boolean;

  #handlers: NodeHandlers = {};

  #trapResultTriggered = false;

  // TODO:BASE, config of subclasses can have more fields
  constructor(
    config: {
      declaringScope?: Scope;
      invokingScope?: Scope;
      serialize?: boolean;
    } = {}
  ) {
    this.#declaringScope = config.declaringScope;
    this.#invokingScope = config.invokingScope;
    this.#isSerializing = config.serialize ?? false;
  }

  // TODO:BASE
  addHandlers(handlers: NodeHandlers) {
    Object.entries(handlers).forEach(
      ([name, handler]) => (this.#handlers[name] = handler)
    );
  }

  // TODO:BASE
  getHandler<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues
  >(name: string): NodeHandler<I, O> | undefined {
    return (this.#handlers[name] ||
      this.#invokingScope?.getHandler(name) ||
      this.#declaringScope?.getHandler(name)) as unknown as NodeHandler<I, O>;
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
  async invoke(node: AbstractNode, callbacks: InvokeCallbacks[] = []) {
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
    }

    // Call done callback
    for (const callback of callbacks) {
      await callback.done?.();
    }
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

  #findAllConnectedNodes(node: AbstractNode) {
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
