/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "./llm-content.js";

export interface Capability {
  readonly kind: string;
}

/**
 * A type representing a valid JSON value.
 */
export type NodeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | NodeValue[]
  | Capability
  | { [key: string]: NodeValue };

/**
 * Unique identifier of a node in a graph.
 */
export type NodeIdentifier = string;

/**
 * Unique identifier of a node's output.
 */
export type OutputIdentifier = string;

/**
 * Unique identifier of a node's input.
 */
export type InputIdentifier = string;

/**
 * Unique identifier of a node's type.
 */
export type NodeTypeIdentifier = string;

/**
 * Represents a node in a graph.
 */
export type NodeDescriptor = {
  /**
   * Unique id of the node in graph.
   */
  id: NodeIdentifier;

  /**
   * Type of the node. Used to look up the handler for the node.
   */
  type: NodeTypeIdentifier;

  /**
   * Configuration of the node.
   */
  configuration?: NodeConfiguration;

  /**
   * The metadata of the node.
   * Use this provide additional information about the node.
   */
  metadata?: NodeMetadata;
};

export type CommentNode = {
  /**
   * Unique id of the comment node in graph metadata.
   */
  id: NodeIdentifier;

  /**
   * The text content of the comment.
   */
  text: string;

  /**
   * The metadata of the comment node.
   * Use this to provide additional information about the comment node.
   */
  metadata?: NodeMetadata;
};

/**
 * Represents an edge in a graph.
 */
export type Edge = {
  /**
   * The node that the edge is coming from.
   */
  from: NodeIdentifier;

  /**
   * The node that the edge is going to.
   */
  to: NodeIdentifier;

  /**
   * The input of the `to` node. If this value is undefined, then
   * the then no data is passed as output of the `from` node.
   */
  in?: InputIdentifier;

  /**
   * The output of the `from` node. If this value is "*", then all outputs
   * of the `from` node are passed to the `to` node. If this value is undefined,
   * then no data is passed to any inputs of the `to` node.
   */
  out?: OutputIdentifier;

  /**
   * If true, this edge is optional: the data that passes through it is not
   * considered a required input to the node.
   */
  optional?: boolean;

  /**
   * If true, this edge acts as a constant: the data that passes through it
   * remains available even after the node has consumed it.
   */
  constant?: boolean;

  /**
   * The metadata of the edge.
   * Use this provide additional information about the edge.
   */
  metadata?: EdgeMetadata;
};

/**
 * Represents metadata of an edge.
 * This is an optional part of the `Edge` that can be used to
 * provide additional information about the node.
 */
export type EdgeMetadata = {
  /**
   * Metadata that conveys visual information about the edge. Can be used by
   * visual editors to store information about the edge's appearance, current
   * position, etc.
   */
  visual?: NodeValue;
};

/**
 * Represents metadata of a node.
 * This is an optional part of the `NodeDescriptor` that can be used to
 * provide additional information about the node.
 */
export type NodeMetadata = {
  /**
   * The title of the node.
   */
  title?: string;
  /**
   * A more detailed description of the node.
   */
  description?: string;
  /**
   * Metadata that conveys visual information about the node. Can be used by
   * visual editors to store information about the node's appearance, current
   * position, etc.
   */
  visual?: NodeValue;
  /**
   * Logging level.
   */
  logLevel?: "debug" | "info";
  /**
   * Tags associated with the node. Can be either a string or a structured tag,
   * like a `StartTag`.
   */
  tags?: NodeTag[];
  /**
   * The icon for the node.
   */
  icon?: string;
  /**
   * If true, the title/description have been modified by the user.
   */
  userModified?: boolean;
};

/**
 * Represents a tag that can be associated with a node.
 */
export type NodeTag = string;

/**
 * Represents references to a "kit": a collection of `NodeHandlers`.
 * The basic premise here is that people can publish kits with interesting
 * handlers, and then graphs can specify which ones they use.
 * The `@google-labs/core-kit` package is an example of kit.
 */
export type KitReference = {
  /**
   * The URL pointing to the location of the kit.
   */
  url: string;
};

/**
 * Represents various tags that can be associated with a kit.
 * - `deprecated`: The kit is deprecated and should not be used.
 * - `experimental`: The kit is experimental and may not be stable.
 */
export type KitTag = "deprecated" | "experimental";

export type KitDescriptor = KitReference & {
  /**
   * The title of the kit.
   */
  title?: string;
  /**
   * The description of the kit.
   */
  description?: string;
  /**
   * Version of the kit.
   * [semver](https://semver.org/) format is encouraged.
   * @pattern ^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$
   */
  version?: string;
  /**
   * Tags, associated with the kit.
   */
  tags?: KitTag[];
};

/**
 * Represents graph metadata that is stored inline in the GraphDescriptor.
 */
export type GraphInlineMetadata = {
  /**
   * The schema of the graph.
   */
  $schema?: string;

  /**
   * The URL pointing to the location of the graph.
   * This URL is used to resolve relative paths in the graph.
   * If not specified, the paths are assumed to be relative to the current
   * working directory.
   */
  url?: string;
  /**
   * The title of the graph.
   */
  title?: string;
  /**
   * The description of the graph.
   */
  description?: string;
  /**
   * Version of the graph.
   * [semver](https://semver.org/) format is encouraged.
   */
  version?: string;
  /**
   * The URL of the graph that will act as the describer for
   * this graph. Can be a relative URL and refer to a sub-graph
   * within this graph.
   *
   * The describers in the format of "module:name" will be interpreted as
   * "use the `describe` export of the module named `name` to describe this
   * graph".
   */
  describer?: string;
};

/**
 * A tag that can be associated with a graph.
 * - `published`: The graph is published (as opposed to a draft). It may be
 *    used in production and shared with others.
 * - `tool`: The graph is intended to be a tool.
 * - `experimental`: The graph is experimental and may not be stable.
 * - `component`: The graph is intended to be a component.
 * - `core`: The graph represents a component that provides "core"
 *    functionality, like control flow, input/output, etc.
 * - `generative`: The graph represents a component that uses an LLM
 * - `quick-access`: The graph represents a component that is featured in quick
 *    access menu.
 * - `private`: Accessing the graph requires authentication (like a server
 *    API key)
 * - `connector`: The graph represents a connector.
 * - `connector-singleton`: This connector is a singleton: only one instance
 *    can be created.
 * - `connector-configure`: The graph provides configuration of a connector.
 * - `connector-load`: The graph provides loading capability of a connector.
 * - `connector-save`: The graph provides saving capability of a connector.
 * - `connector-tools`: The graph provides tool discovery and calling
 *    capability of a connector.

 */
export type GraphTag =
  | "published"
  | "tool"
  | "experimental"
  | "featured"
  | "component"
  | "deprecated"
  | "core"
  | "generative"
  | "quick-access"
  | "private"
  | "connector"
  | "connector-singleton"
  | "connector-configure"
  | "connector-load"
  | "connector-save"
  | "connector-tools";

/**
 * Metadata about a parameter
 */
export type ParameterMetadata = {
  title: string;
  description?: string;
  /**
   * A list of modality hints that define the kind of content the parameter
   * may contain.
   */
  modality?: string[];
  /**
   * Sample value that will be provided as part of the user input
   * Must be LLMContent[], but is typed as NodeValue because for some reason,
   * GraphDescriptor doesn't like LLMContent[] here.
   */
  sample?: NodeValue;
  /**
   * The list of nodes where the parameter is currently used.
   * Can be empty, which indicates that this metadata is not attached
   * to any existing parameter.
   */
  usedIn: NodeIdentifier[];
};

export type GraphTheme = {
  themeColors?: Record<string, string>;
  template?: string;
  templateAdditionalOptions?: Record<string, string>;
  splashScreen?: StoredDataCapabilityPart;
};

/**
 * Represents graph metadata.
 */
export type GraphMetadata = {
  /**
   * The icon that identifies the graph. Can be a URL or a Material Design id.
   */
  icon?: string;
  [name: string]: NodeValue;
  comments?: CommentNode[];
  /**
   * Tags associated with the graph.
   */
  tags?: GraphTag[];
  /**
   * The overall intent or goal of the application.
   */
  intent?: string;
  /**
   * The documentation for the graph, expressed as a URL and optional description.
   */
  help?: {
    description?: string;
    url: string;
  };
  /**
   * The URL of the graph that will act as the describer for
   * this graph. Can be a relative URL and refer to a sub-graph
   * within this graph.
   *
   * The describers in the format of "module:name" will be interpreted as
   * "use the `describe` export of the module named `name` to describe this
   * graph".
   */
  describer?: string;
  /**
   * The metadata associated with the visual representation of the graph.
   */
  visual?: {
    /**
     * Last known position of the graph in the editor.
     */
    window?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    /**
     * Whether or not the graph is minimized. Generally only applies to
     * subgraphs as they carry that control in the Visual Editor.
     */
    minimized?: boolean;
    presentation?: {
      title?: string;
      author?: string;
      themeColors?: Record<string, string>;
      template?: string;
      templateAdditionalOptions?: Record<string, string>;
      icon?: string;
      splashScreen?: InlineDataCapabilityPart;
      description?: string;
      linkToSource?: string;

      /**
       * The collection of themes and the chosen theme for this graph.
       */
      theme?: string;
      themes?: Record<string, GraphTheme>;
    };
  };

  /**
   * Allows specifying relative order of this graph when it is represented
   * as a component in any menu. Currently used when populating the
   * quick access menu.
   */
  order?: number;

  /**
   * If true, the title/description have been modified by the user.
   */
  userModified?: boolean;

  /**
   * Provides a way to store metadata about parameters
   * See https://github.com/breadboard-ai/breadboard/wiki/Parameters-Design
   */
  parameters?: Record<string, ParameterMetadata>;
};

/**
 * Unique identifier of a graph.
 */
export type GraphIdentifier = string;

/**
 * Represents a collection of sub-graphs.
 * The key is the identifier of the sub-graph.
 * The value is the descriptor of the sub-graph.
 */
export type SubGraphs = Record<GraphIdentifier, GraphDescriptor>;

/**
 * Properties used for testing the foundational traversal tests
 * These properties are for internal testing only and should not be used.
 * @deprecated These properties are for internal testing only and should not be used.
 */
type TestProperties = {
  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  inputs?: InputValues;

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  outputs?: OutputValues | OutputValues[];

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  sequence?: NodeIdentifier[];

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  throws?: boolean;

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  safe?: boolean;

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  expectedLabels?: string[][];

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  explanation?: string;

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  start?: NodeIdentifier;
};

/**
 * Unique identifier of a module.
 */
export type ModuleIdentifier = string;

/**
 * The code for this module, which should include a describer, an invoker, and
 * any other relevant information to power the module.
 */
export type ModuleCode = string;

/**
 * A tag that can be associated with a graph.
 * - `published`: The module is published (as opposed to a draft). It may be
 *    used in production and shared with others.
 * - `experimental`: The graph is experimental and may not be stable.
 */
export type ModuleTag = "published" | "experimental";

export type ModuleLanguage = string;

export type ModuleMetadata = {
  /**
   * Whether the module should be presented as a runnable item to runModule.
   */
  runnable?: boolean;

  /**
   * The icon for the module.
   */
  icon?: string;

  /**
   * The source file for the module, if relevant.
   */
  url?: string;

  /**
   * The description for the module.
   */
  description?: string;

  /**
   * The title for the module.
   */
  title?: string;

  /**
   * Tags associated with the module. At this moment, free-form strings.
   */
  tags?: ModuleTag[];

  /**
   * The documentation for the module, expressed as a URL and optional description.
   */
  help?: {
    description?: string;
    url: string;
  };

  /**
   * The pre-compiled source for this module.
   */
  source?: {
    language: ModuleLanguage;
    code: ModuleCode;
  };
};

export type Module = {
  /**
   * Metadata associated with the graph.
   */
  metadata?: ModuleMetadata;

  /**
   * The code for this module.
   */
  code: ModuleCode;
};

export type Modules = Record<ModuleIdentifier, Module>;

export type AssetPath = string;

/**
 * Provides information on the structure of the data stored in the asset.
 * All data is stored as LLMContent[], but this field allows us to better
 * identify what is stored.
 *
 * - "content" -- the typical LLMContent[], should be editable in asset
 *   viewer as if the configuration port of a component.
 * - "file" -- user-uploaded file. In this case, the data must be:
 *   - a single inlineData part with the right mimeType
 *   - of a single LLMContent item
 * - "connector" -- a [connector](https://github.com/breadboard-ai/breadboard/wiki/Connectors)
 */
export type AssetType = "content" | "file" | "connector";

export type AssetMetadata = {
  title: string;
  description?: string;
  type: AssetType;
  subType?: string;
  visual?: NodeValue;
};

export type Asset = {
  metadata?: AssetMetadata;
  /**
   * Must be LLMContent[], but is typed as NodeValue because for some reason,
   * GraphDescriptor doesn't like LLMContent[] here.
   */
  data: NodeValue;
};

/**
 * An identifier to use for imports.
 */
export type ImportIdentifier = string;

/**
 * A declaration of an import.
 */
export type Import = {
  /**
   * The URL of the import. Must point to a valid `GraphDescriptor`.
   * Can be relative or absolute.
   * When relative, the URL will be evaluated relative to the value of the
   * `url` property of this `GraphDescriptor`.
   */
  url: string;
};

export type GraphCommonProperties = GraphInlineMetadata & {
  /**
   * Metadata associated with the graph.
   */
  metadata?: GraphMetadata;

  /**
   * Arguments that are passed to the graph, useful to bind values to graphs.
   */
  args?: InputValues;

  /**
   * Modules that are included as part of this graph.
   */
  modules?: Modules;

  /**
   * The modules and sub-graphs that this graph declares as "exports": they
   * themselves are usable declarative or imperative graphs.
   * When the "exports" property exist, this graph is actually a Kit
   * declaration: it can be used to distributed multiple graphs.
   */
  exports?: (ModuleIdentifier | `#${GraphIdentifier}`)[];

  /**
   * An optional property that indicates that this graph is
   * "virtual": it can not be represented by a static list
   * of edges and nodes, and is instead more of a representation
   * of something that's "graph-like".
   * Modules, when they invoke capabilities, are "virtual" graphs:
   * they don't have a defined topology and instead, this topology
   * is discovered through imperative code execution
   */
  virtual?: true;

  /**
   * An optional collection of assets associated with the graph. Each asset
   * is an array of LLM Content items.
   */
  assets?: Record<AssetPath, Asset>;

  /**
   * An optional collection of imports, or known GraphDescriptors that
   * this GraphDescriptor uses. Imports are spiritually similar to
   * `dependencies` in npm or import maps in Web Platform. In addition to
   * specifying the depenency, they provide a short identifier that can be
   * used to refer to the import.
   */
  imports?: Record<ImportIdentifier, Import>;
};

/**
 * Represents a typical graph: a collection of nodes and edges that form
 * the graph topology.
 */
export type DeclarativeGraph = GraphCommonProperties & {
  /**
   * The collection of all edges in the graph.
   */
  edges: Edge[];

  /**
   * The collection of all nodes in the graph.
   */
  nodes: NodeDescriptor[];

  /**
   * All the kits (collections of node handlers) that are used by the graph.
   */
  kits?: KitDescriptor[];

  /**
   * Sub-graphs that are also described by this graph representation.
   */
  graphs?: SubGraphs;
};

/**
 * Represents a graph that's backed by code rather than nodes and edges.
 */
export type ImperativeGraph = GraphCommonProperties & {
  /**
   * The id of the Module that is used as an entry point for this graph.
   * If this value is set, the graph is a "module graph": it is backed
   * by code rather than by nodes and edges.
   */
  main: ModuleIdentifier;
};

/**
 * A union type of both declarative and imperative graphs. Represents a graph
 * that is either declarative (defined by nodes and edges) or imperative
 * (backed by code).
 */
export type GraphDescriptor = GraphCommonProperties &
  DeclarativeGraph &
  Partial<ImperativeGraph> &
  TestProperties;

/**
 * Values that are supplied as inputs to the `NodeHandler`.
 */
export type InputValues = Record<InputIdentifier, NodeValue>;

/**
 * Values that the `NodeHandler` outputs.
 */
export type OutputValues = Record<OutputIdentifier, NodeValue>;

/**
 * Values that are supplied as part of the graph. These values are merged with
 * the `InputValues` and supplied as inputs to the `NodeHandler`.
 */
export type NodeConfiguration = Record<string, NodeValue>;
