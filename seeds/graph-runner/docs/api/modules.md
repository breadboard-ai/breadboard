[@google-labs/graph-runner](README.md) / Exports

# @google-labs/graph-runner

## Table of contents

### Classes

- [MachineResult](classes/MachineResult.md)
- [TraversalMachine](classes/TraversalMachine.md)

### Interfaces

- [Capability](interfaces/Capability.md)
- [TraversalResult](interfaces/TraversalResult.md)

### Type Aliases

- [Edge](modules.md#edge)
- [ErrorCapability](modules.md#errorcapability)
- [GraphDescriptor](modules.md#graphdescriptor)
- [GraphMetadata](modules.md#graphmetadata)
- [InputValues](modules.md#inputvalues)
- [KitDescriptor](modules.md#kitdescriptor)
- [NodeConfiguration](modules.md#nodeconfiguration)
- [NodeDescriptor](modules.md#nodedescriptor)
- [NodeHandler](modules.md#nodehandler)
- [NodeHandlers](modules.md#nodehandlers)
- [NodeTypeIdentifier](modules.md#nodetypeidentifier)
- [NodeValue](modules.md#nodevalue)
- [OutputValues](modules.md#outputvalues)
- [SubGraphs](modules.md#subgraphs)

### Functions

- [toMermaid](modules.md#tomermaid)

## Type Aliases

### Edge

Ƭ **Edge**: `Object`

Represents an edge in a graph.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `constant?` | `boolean` | If true, this edge acts as a constant: the data that passes through it remains available even after the node has consumed it. |
| `from` | `NodeIdentifier` | The node that the edge is coming from. |
| `in?` | `InputIdentifier` | The input of the `to` node. If this value is undefined, then the then no data is passed as output of the `from` node. |
| `optional?` | `boolean` | If true, this edge is optional: the data that passes through it is not considered a required input to the node. |
| `out?` | `OutputIdentifier` | The output of the `from` node. If this value is "*", then all outputs of the `from` node are passed to the `to` node. If this value is undefined, then no data is passed to any inputs of the `to` node. |
| `to` | `NodeIdentifier` | The node that the edge is going to. |

#### Defined in

[types.ts:74](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L74)

___

### ErrorCapability

Ƭ **ErrorCapability**: [`Capability`](interfaces/Capability.md) & { `descriptor?`: [`NodeDescriptor`](modules.md#nodedescriptor) ; `error?`: `Error` ; `inputs?`: [`InputValues`](modules.md#inputvalues) ; `kind`: ``"error"``  }

#### Defined in

[types.ts:11](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L11)

___

### GraphDescriptor

Ƭ **GraphDescriptor**: [`GraphMetadata`](modules.md#graphmetadata) & { `edges`: [`Edge`](modules.md#edge)[] ; `graphs?`: [`SubGraphs`](modules.md#subgraphs) ; `kits?`: [`KitDescriptor`](modules.md#kitdescriptor)[] ; `nodes`: [`NodeDescriptor`](modules.md#nodedescriptor)[]  }

Represents a graph.

#### Defined in

[types.ts:171](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L171)

___

### GraphMetadata

Ƭ **GraphMetadata**: `Object`

Represents graph metadata.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `description?` | `string` | The description of the graph. |
| `title?` | `string` | The title of the graph. |
| `url?` | `string` | The URL pointing to the location of the graph. This URL is used to resolve relative paths in the graph. If not specified, the paths are assumed to be relative to the current working directory. |
| `version?` | `string` | Version of the graph. [semver](https://semver.org/) format is encouraged. |

#### Defined in

[types.ts:133](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L133)

___

### InputValues

Ƭ **InputValues**: `Record`<`InputIdentifier`, [`NodeValue`](modules.md#nodevalue)\>

Values that are supplied as inputs to the `NodeHandler`.

#### Defined in

[types.ts:229](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L229)

___

### KitDescriptor

Ƭ **KitDescriptor**: `Object`

Represents a "kit": a collection of `NodeHandlers`. The basic permise here
is that people can publish kits with interesting handlers, and then
graphs can specify which ones they use.
The `@google-labs/llm-starter` package is an example of kit.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `url` | `string` | The URL pointing to the location of the kit. |
| `using?` | `string`[] | The list of node types in this kit that are used by the graph. If left blank or omitted, all node types are assumed to be used. |

#### Defined in

[types.ts:117](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L117)

___

### NodeConfiguration

Ƭ **NodeConfiguration**: `Record`<`string`, [`NodeValue`](modules.md#nodevalue)\>

Values that are supplied as part of the graph. These values are merged with
the `InputValues` and supplied as inputs to the `NodeHandler`.

#### Defined in

[types.ts:240](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L240)

___

### NodeDescriptor

Ƭ **NodeDescriptor**: `Object`

Represents a node in a graph.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `configuration?` | [`NodeConfiguration`](modules.md#nodeconfiguration) | Configuration of the node. |
| `id` | `NodeIdentifier` | Unique id of the node in graph. |
| `type` | [`NodeTypeIdentifier`](modules.md#nodetypeidentifier) | Type of the node. Used to look up the handler for the node. |

#### Defined in

[types.ts:54](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L54)

___

### NodeHandler

Ƭ **NodeHandler**: (`inputs`: [`InputValues`](modules.md#inputvalues)) => `Promise`<[`OutputValues`](modules.md#outputvalues) \| `void`\>

#### Type declaration

▸ (`inputs`): `Promise`<[`OutputValues`](modules.md#outputvalues) \| `void`\>

A function that represents a type of a node in the graph.

##### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`InputValues`](modules.md#inputvalues) |

##### Returns

`Promise`<[`OutputValues`](modules.md#outputvalues) \| `void`\>

#### Defined in

[types.ts:245](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L245)

___

### NodeHandlers

Ƭ **NodeHandlers**: `Record`<[`NodeTypeIdentifier`](modules.md#nodetypeidentifier), [`NodeHandler`](modules.md#nodehandler)\>

All known node handlers.

#### Defined in

[types.ts:255](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L255)

___

### NodeTypeIdentifier

Ƭ **NodeTypeIdentifier**: `string`

Unique identifier of a node's type.

#### Defined in

[types.ts:49](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L49)

___

### NodeValue

Ƭ **NodeValue**: `string` \| `number` \| `boolean` \| ``null`` \| `undefined` \| [`NodeValue`](modules.md#nodevalue)[] \| [`Capability`](interfaces/Capability.md) \| { `[key: string]`: [`NodeValue`](modules.md#nodevalue);  }

A type representing a valid JSON value.

#### Defined in

[types.ts:21](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L21)

___

### OutputValues

Ƭ **OutputValues**: `Partial`<`Record`<`OutputIdentifier`, [`NodeValue`](modules.md#nodevalue)\>\>

Values that the `NodeHandler` outputs.

#### Defined in

[types.ts:234](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L234)

___

### SubGraphs

Ƭ **SubGraphs**: `Record`<`GraphIdentifier`, [`GraphDescriptor`](modules.md#graphdescriptor)\>

Represents a collection of sub-graphs.
The key is the identifier of the sub-graph.
The value is the descriptor of the sub-graph.

#### Defined in

[types.ts:166](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/types.ts#L166)

## Functions

### toMermaid

▸ **toMermaid**(`graph`, `direction?`): `string`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `graph` | [`GraphDescriptor`](modules.md#graphdescriptor) | `undefined` |
| `direction` | `string` | `"TD"` |

#### Returns

`string`

#### Defined in

[mermaid.ts:201](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/mermaid.ts#L201)
