/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
  ScopeConfig,
} from "./types.js";

import { NodeDescriberResult, Schema } from "../../types.js";

export class Scope implements ScopeInterface {
  #lexicalScope?: ScopeInterface;
  #dynamicScope?: ScopeInterface;

  #handlers: NodeHandlers = {};

  constructor(config: ScopeConfig = {}) {
    this.#lexicalScope = config.lexicalScope;
    this.#dynamicScope = config.dynamicScope;
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
      this.#dynamicScope?.getHandler(name) ||
      this.#lexicalScope?.getHandler(name)) as unknown as NodeHandler<I, O>;
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

  async invokeOnce(
    node: AbstractNode,
    inputs: InputValues,
    callbacks: InvokeCallbacks[] = []
  ): Promise<OutputValues> {
    let resolver: (outputs: OutputValues) => void;
    const promise = new Promise<OutputValues>((resolve) => {
      resolver = resolve;
    });

    const scope = new Scope({ dynamicScope: this });

    scope.addHandlers({
      input: async () => {
        return inputs;
      },
      output: async (inputs: InputValues | PromiseLike<InputValues>) => {
        resolver(await inputs);
        return {};
      },
    });

    scope.invoke(node, callbacks);

    // TODO: This will wait forever if there was no output node.
    return promise;
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

        // Save subgraphs returned, typically for `invoke` nodes that call
        // serialized graphs or functions.
        if (subGraph) graphs[nodeDescriptor.id] = subGraph;

        // If `input` or `output` nodes don't have a schema, derive it from
        // their wires, calling the respective nodes' describe method.
        if (
          (nodeDescriptor.type === "input" ||
            nodeDescriptor.type === "output") &&
          !nodeDescriptor.configuration?.schema
        ) {
          const schema = await this.#addMissingSchemas(node);
          if (Object.entries(schema.properties ?? {}).length > 0)
            nodeDescriptor.configuration = {
              ...nodeDescriptor.configuration,
              schema,
            };
        }

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

  async #getSchemasForNode(
    node: AbstractNode
  ): Promise<NodeDescriberResult | undefined> {
    const incomingPorts = Object.fromEntries(
      node.incoming
        .filter((edge) => edge.out !== "" && edge.out !== "*")
        .map((edge) => [edge.out, {}])
    );
    const outgoingPorts = Object.fromEntries(
      node.outgoing
        .filter((edge) => edge.out !== "" && edge.out !== "*")
        .map((edge) => [edge.out, {}])
    );

    return await node.describe(
      this,
      node.configuration,
      { properties: incomingPorts },
      { properties: outgoingPorts }
    );
  }

  async #addMissingSchemas(node: AbstractNode): Promise<Schema> {
    const properties: Schema["properties"] = {};
    const ports = new Set<string>();

    if (node.type === "input") {
      const nodes = new Set<AbstractNode>();

      // Find all nodes downstream of this input node, note all ports
      for (const edge of node.outgoing)
        if (edge.out !== "*" && edge.out !== "") {
          nodes.add(edge.to);
          ports.add(edge.out);
        }

      // For each node, get the schema and copy over the ports we care about
      for (const toNode of nodes) {
        const schema = await this.#getSchemasForNode(toNode);
        const schemaPorts = schema?.inputSchema?.properties;
        if (schemaPorts)
          for (const edge of toNode.incoming)
            if (edge.from === node && schemaPorts[edge.in])
              properties[edge.out] = schemaPorts[edge.in];
      }
    } else if (node.type === "output") {
      const nodes = new Set<AbstractNode>();

      // Find all nodes upstream of this output node, note all ports
      for (const edge of node.incoming)
        if (edge.out !== "*" && edge.out !== "") {
          nodes.add(edge.from);
          ports.add(edge.in);
        }

      // For each node, get the schema and copy over the ports we care about
      for (const fromNode of nodes) {
        const schema = await this.#getSchemasForNode(fromNode);
        const schemaPorts = schema?.outputSchema?.properties;
        if (schemaPorts)
          for (const edge of fromNode.outgoing)
            if (edge.to === node && schemaPorts[edge.out])
              properties[edge.in] = schemaPorts[edge.out];
      }
    } else {
      throw new Error("Can't yet derive schema for non-input/output nodes");
    }

    for (const port of ports)
      if (!properties[port]) properties[port] = { type: "string", title: port };

    return {
      type: "object",
      properties,
      required: Object.keys(properties),
    } satisfies Schema;
  }
}
