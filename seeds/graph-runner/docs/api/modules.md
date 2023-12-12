[@google-labs/graph-runner](README.md) / Exports

# @google-labs/graph-runner

## Table of contents

### Classes

- [MachineResult](classes/MachineResult.md)
- [TraversalMachine](classes/TraversalMachine.md)

### Interfaces

- [Capability](interfaces/Capability.md)
- [Schema](interfaces/Schema.md)
- [TraversalResult](interfaces/TraversalResult.md)

### Type Aliases

- [Edge](modules.md#edge)
- [ErrorCapability](modules.md#errorcapability)
- [GraphDescriptor](modules.md#graphdescriptor)
- [GraphMetadata](modules.md#graphmetadata)
- [InputValues](modules.md#inputvalues)
- [KitDescriptor](modules.md#kitdescriptor)
- [KitReference](modules.md#kitreference)
- [NodeConfiguration](modules.md#nodeconfiguration)
- [NodeDescriberFunction](modules.md#nodedescriberfunction)
- [NodeDescriberResult](modules.md#nodedescriberresult)
- [NodeDescriptor](modules.md#nodedescriptor)
- [NodeHandler](modules.md#nodehandler)
- [NodeHandlerFunction](modules.md#nodehandlerfunction)
- [NodeHandlers](modules.md#nodehandlers)
- [NodeIdentifier](modules.md#nodeidentifier)
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

| Name        | Type                                          | Description                                                                                                                                                                                               |
| :---------- | :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constant?` | `boolean`                                     | If true, this edge acts as a constant: the data that passes through it remains available even after the node has consumed it.                                                                             |
| `from`      | [`NodeIdentifier`](modules.md#nodeidentifier) | The node that the edge is coming from.                                                                                                                                                                    |
| `in?`       | `InputIdentifier`                             | The input of the `to` node. If this value is undefined, then the then no data is passed as output of the `from` node.                                                                                     |
| `optional?` | `boolean`                                     | If true, this edge is optional: the data that passes through it is not considered a required input to the node.                                                                                           |
| `out?`      | `OutputIdentifier`                            | The output of the `from` node. If this value is "\*", then all outputs of the `from` node are passed to the `to` node. If this value is undefined, then no data is passed to any inputs of the `to` node. |
| `to`        | [`NodeIdentifier`](modules.md#nodeidentifier) | The node that the edge is going to.                                                                                                                                                                       |

#### Defined in

[seeds/graph-runner/src/types.ts:76](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L76)

---

### ErrorCapability

Ƭ **ErrorCapability**: [`Capability`](interfaces/Capability.md) & { `descriptor?`: [`NodeDescriptor`](modules.md#nodedescriptor) ; `error?`: `Error` ; `inputs?`: [`InputValues`](modules.md#inputvalues) ; `kind`: `"error"` }

#### Defined in

[seeds/graph-runner/src/types.ts:13](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L13)

---

### GraphDescriptor

Ƭ **GraphDescriptor**: [`GraphMetadata`](modules.md#graphmetadata) & { `args?`: [`InputValues`](modules.md#inputvalues) ; `edges`: [`Edge`](modules.md#edge)[] ; `graphs?`: [`SubGraphs`](modules.md#subgraphs) ; `kits?`: [`KitReference`](modules.md#kitreference)[] ; `nodes`: [`NodeDescriptor`](modules.md#nodedescriptor)[] }

Represents a graph.

#### Defined in

[seeds/graph-runner/src/types.ts:183](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L183)

---

### GraphMetadata

Ƭ **GraphMetadata**: `Object`

Represents graph metadata.

#### Type declaration

| Name           | Type     | Description                                                                                                                                                                                      |
| :------------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description?` | `string` | The description of the graph.                                                                                                                                                                    |
| `title?`       | `string` | The title of the graph.                                                                                                                                                                          |
| `url?`         | `string` | The URL pointing to the location of the graph. This URL is used to resolve relative paths in the graph. If not specified, the paths are assumed to be relative to the current working directory. |
| `version?`     | `string` | Version of the graph. [semver](https://semver.org/) format is encouraged.                                                                                                                        |

#### Defined in

[seeds/graph-runner/src/types.ts:145](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L145)

---

### InputValues

Ƭ **InputValues**: `Record`<`InputIdentifier`, [`NodeValue`](modules.md#nodevalue)\>

Values that are supplied as inputs to the `NodeHandler`.

#### Defined in

[seeds/graph-runner/src/types.ts:246](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L246)

---

### KitDescriptor

Ƭ **KitDescriptor**: [`KitReference`](modules.md#kitreference) & { `description?`: `string` ; `title?`: `string` ; `version?`: `string` }

#### Defined in

[seeds/graph-runner/src/types.ts:126](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L126)

---

### KitReference

Ƭ **KitReference**: `Object`

Represents references to a "kit": a collection of `NodeHandlers`.
The basic permise here is that people can publish kits with interesting
handlers, and then graphs can specify which ones they use.
The `@google-labs/llm-starter` package is an example of kit.

#### Type declaration

| Name  | Type     | Description                                  |
| :---- | :------- | :------------------------------------------- |
| `url` | `string` | The URL pointing to the location of the kit. |

#### Defined in

[seeds/graph-runner/src/types.ts:119](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L119)

---

### NodeConfiguration

Ƭ **NodeConfiguration**: `Record`<`string`, [`NodeValue`](modules.md#nodevalue)\>

Values that are supplied as part of the graph. These values are merged with
the `InputValues` and supplied as inputs to the `NodeHandler`.

#### Defined in

[seeds/graph-runner/src/types.ts:257](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L257)

---

### NodeDescriberFunction

Ƭ **NodeDescriberFunction**: (`inputs?`: [`InputValues`](modules.md#inputvalues), `inputSchema?`: [`Schema`](interfaces/Schema.md), `outputSchema?`: [`Schema`](interfaces/Schema.md)) => `Promise`<[`NodeDescriberResult`](modules.md#nodedescriberresult)\>

#### Type declaration

▸ (`inputs?`, `inputSchema?`, `outputSchema?`): `Promise`<[`NodeDescriberResult`](modules.md#nodedescriberresult)\>

Asks to describe a node. Can be called in multiple ways:

- when called with no arguments, will produce the "default schema". That is,
  the inputs/outputs that are always available.
- when called with inputs and schemas, will produce the "expected schema".
  For example, when a node changes its schema based on the actual inputs,
  it will return different schemas when inputs/schemas are supplied than
  when they are not.

##### Parameters

| Name            | Type                                    |
| :-------------- | :-------------------------------------- |
| `inputs?`       | [`InputValues`](modules.md#inputvalues) |
| `inputSchema?`  | [`Schema`](interfaces/Schema.md)        |
| `outputSchema?` | [`Schema`](interfaces/Schema.md)        |

##### Returns

`Promise`<[`NodeDescriberResult`](modules.md#nodedescriberresult)\>

#### Defined in

[seeds/graph-runner/src/types.ts:298](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L298)

---

### NodeDescriberResult

Ƭ **NodeDescriberResult**: `Object`

The result of running `NodeDescriptorFunction`

#### Type declaration

| Name           | Type                             |
| :------------- | :------------------------------- |
| `inputSchema`  | [`Schema`](interfaces/Schema.md) |
| `outputSchema` | [`Schema`](interfaces/Schema.md) |

#### Defined in

[seeds/graph-runner/src/types.ts:284](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L284)

---

### NodeDescriptor

Ƭ **NodeDescriptor**: `Object`

Represents a node in a graph.

#### Type declaration

| Name             | Type                                                  | Description                                                 |
| :--------------- | :---------------------------------------------------- | :---------------------------------------------------------- |
| `configuration?` | [`NodeConfiguration`](modules.md#nodeconfiguration)   | Configuration of the node.                                  |
| `id`             | [`NodeIdentifier`](modules.md#nodeidentifier)         | Unique id of the node in graph.                             |
| `type`           | [`NodeTypeIdentifier`](modules.md#nodetypeidentifier) | Type of the node. Used to look up the handler for the node. |

#### Defined in

[seeds/graph-runner/src/types.ts:56](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L56)

---

### NodeHandler

Ƭ **NodeHandler**<`Context`\>: { `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `invoke`: [`NodeHandlerFunction`](modules.md#nodehandlerfunction)<`Context`\> } \| [`NodeHandlerFunction`](modules.md#nodehandlerfunction)<`Context`\>

#### Type parameters

| Name      |
| :-------- |
| `Context` |

#### Defined in

[seeds/graph-runner/src/types.ts:304](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L304)

---

### NodeHandlerFunction

Ƭ **NodeHandlerFunction**<`T`\>: (`inputs`: [`InputValues`](modules.md#inputvalues), `context`: `T`) => `Promise`<[`OutputValues`](modules.md#outputvalues) \| `void`\>

#### Type parameters

| Name |
| :--- |
| `T`  |

#### Type declaration

▸ (`inputs`, `context`): `Promise`<[`OutputValues`](modules.md#outputvalues) \| `void`\>

A function that represents a type of a node in the graph.

##### Parameters

| Name      | Type                                    |
| :-------- | :-------------------------------------- |
| `inputs`  | [`InputValues`](modules.md#inputvalues) |
| `context` | `T`                                     |

##### Returns

`Promise`<[`OutputValues`](modules.md#outputvalues) \| `void`\>

#### Defined in

[seeds/graph-runner/src/types.ts:262](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L262)

---

### NodeHandlers

Ƭ **NodeHandlers**<`T`\>: `ReservedNodeNames` & `Record`<[`NodeTypeIdentifier`](modules.md#nodetypeidentifier), [`NodeHandler`](modules.md#nodehandler)<`T`\>\>

All known node handlers.

#### Type parameters

| Name | Type     |
| :--- | :------- |
| `T`  | `object` |

#### Defined in

[seeds/graph-runner/src/types.ts:314](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L314)

---

### NodeIdentifier

Ƭ **NodeIdentifier**: `string`

Unique identifier of a node in a graph.

#### Defined in

[seeds/graph-runner/src/types.ts:36](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L36)

---

### NodeTypeIdentifier

Ƭ **NodeTypeIdentifier**: `string`

Unique identifier of a node's type.

#### Defined in

[seeds/graph-runner/src/types.ts:51](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L51)

---

### NodeValue

Ƭ **NodeValue**: `string` \| `number` \| `boolean` \| `null` \| `undefined` \| [`NodeValue`](modules.md#nodevalue)[] \| [`Capability`](interfaces/Capability.md) \| { `[key: string]`: [`NodeValue`](modules.md#nodevalue); }

A type representing a valid JSON value.

#### Defined in

[seeds/graph-runner/src/types.ts:23](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L23)

---

### OutputValues

Ƭ **OutputValues**: `Partial`<`Record`<`OutputIdentifier`, [`NodeValue`](modules.md#nodevalue)\>\>

Values that the `NodeHandler` outputs.

#### Defined in

[seeds/graph-runner/src/types.ts:251](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L251)

---

### SubGraphs

Ƭ **SubGraphs**: `Record`<`GraphIdentifier`, [`GraphDescriptor`](modules.md#graphdescriptor)\>

Represents a collection of sub-graphs.
The key is the identifier of the sub-graph.
The value is the descriptor of the sub-graph.

#### Defined in

[seeds/graph-runner/src/types.ts:178](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L178)

## Functions

### toMermaid

▸ **toMermaid**(`graph`, `direction?`): `string`

#### Parameters

| Name        | Type                                            | Default value |
| :---------- | :---------------------------------------------- | :------------ |
| `graph`     | [`GraphDescriptor`](modules.md#graphdescriptor) | `undefined`   |
| `direction` | `string`                                        | `"TD"`        |

#### Returns

`string`

#### Defined in

[seeds/graph-runner/src/mermaid.ts:201](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/mermaid.ts#L201)
