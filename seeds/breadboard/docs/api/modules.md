[@google-labs/breadboard](README.md) / Exports

# @google-labs/breadboard

## Table of contents

### Classes

- [Board](classes/Board.md)
- [BoardRunner](classes/BoardRunner.md)
- [DebugProbe](classes/DebugProbe.md)
- [LogProbe](classes/LogProbe.md)
- [MachineResult](classes/MachineResult.md)
- [Node](classes/Node.md)
- [RunResult](classes/RunResult.md)
- [TraversalMachine](classes/TraversalMachine.md)

### Interfaces

- [BreadboardNode](interfaces/BreadboardNode.md)
- [BreadboardValidator](interfaces/BreadboardValidator.md)
- [BreadboardValidatorMetadata](interfaces/BreadboardValidatorMetadata.md)
- [Capability](interfaces/Capability.md)
- [Kit](interfaces/Kit.md)
- [KitConstructor](interfaces/KitConstructor.md)
- [NodeFactory](interfaces/NodeFactory.md)
- [NodeHandlerContext](interfaces/NodeHandlerContext.md)
- [Schema](interfaces/Schema.md)
- [TraversalResult](interfaces/TraversalResult.md)

### Type Aliases

- [BreadboardCapability](modules.md#breadboardcapability)
- [BreadboardSlotSpec](modules.md#breadboardslotspec)
- [ConfigOrLambda](modules.md#configorlambda)
- [Edge](modules.md#edge)
- [ErrorCapability](modules.md#errorcapability)
- [GenericKit](modules.md#generickit)
- [GraphDescriptor](modules.md#graphdescriptor)
- [GraphMetadata](modules.md#graphmetadata)
- [InputValues](modules.md#inputvalues)
- [KitDescriptor](modules.md#kitdescriptor)
- [KitReference](modules.md#kitreference)
- [LambdaFunction](modules.md#lambdafunction)
- [NodeConfiguration](modules.md#nodeconfiguration)
- [NodeConfigurationConstructor](modules.md#nodeconfigurationconstructor)
- [NodeDescriberFunction](modules.md#nodedescriberfunction)
- [NodeDescriberResult](modules.md#nodedescriberresult)
- [NodeDescriptor](modules.md#nodedescriptor)
- [NodeHandler](modules.md#nodehandler)
- [NodeHandlerFunction](modules.md#nodehandlerfunction)
- [NodeHandlers](modules.md#nodehandlers)
- [NodeIdentifier](modules.md#nodeidentifier)
- [NodeTypeIdentifier](modules.md#nodetypeidentifier)
- [NodeValue](modules.md#nodevalue)
- [OptionalIdConfiguration](modules.md#optionalidconfiguration)
- [OutputValues](modules.md#outputvalues)
- [ProbeEvent](modules.md#probeevent)
- [RunResultType](modules.md#runresulttype)
- [SubGraphs](modules.md#subgraphs)

### Functions

- [toMermaid](modules.md#tomermaid)

## Type Aliases

### BreadboardCapability

Ƭ **BreadboardCapability**: [`Capability`](interfaces/Capability.md) & { `board`: [`GraphDescriptor`](modules.md#graphdescriptor) ; `kind`: ``"board"``  }

#### Defined in

[seeds/breadboard/src/types.ts:517](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L517)

___

### BreadboardSlotSpec

Ƭ **BreadboardSlotSpec**: `Record`<`string`, [`GraphDescriptor`](modules.md#graphdescriptor)\>

#### Defined in

[seeds/breadboard/src/types.ts:321](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L321)

___

### ConfigOrLambda

Ƭ **ConfigOrLambda**<`In`, `Out`\>: [`OptionalIdConfiguration`](modules.md#optionalidconfiguration) \| [`BreadboardCapability`](modules.md#breadboardcapability) \| [`BreadboardNode`](interfaces/BreadboardNode.md)<`LambdaNodeInputs`, `LambdaNodeOutputs`\> \| [`GraphDescriptor`](modules.md#graphdescriptor) \| [`LambdaFunction`](modules.md#lambdafunction)<`In`, `Out`\> \| { `board`: [`BreadboardCapability`](modules.md#breadboardcapability) \| [`BreadboardNode`](interfaces/BreadboardNode.md)<`LambdaNodeInputs`, `LambdaNodeOutputs`\> \| [`LambdaFunction`](modules.md#lambdafunction)<`In`, `Out`\>  }

Synctactic sugar for node factories that accept lambdas. This allows passing
either
 - A JS function that is a lambda function defining the board
 - A board capability, i.e. the result of calling lambda()
 - A board node, which should be a node with a `board` output
or
 - A regular config, with a `board` property with any of the above.

use `getConfigWithLambda()` to turn this into a regular config.

#### Type parameters

| Name |
| :------ |
| `In` |
| `Out` |

#### Defined in

[seeds/breadboard/src/types.ts:616](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L616)

___

### Edge

Ƭ **Edge**: `Object`

Represents an edge in a graph.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `constant?` | `boolean` | If true, this edge acts as a constant: the data that passes through it remains available even after the node has consumed it. |
| `from` | [`NodeIdentifier`](modules.md#nodeidentifier) | The node that the edge is coming from. |
| `in?` | `InputIdentifier` | The input of the `to` node. If this value is undefined, then the then no data is passed as output of the `from` node. |
| `optional?` | `boolean` | If true, this edge is optional: the data that passes through it is not considered a required input to the node. |
| `out?` | `OutputIdentifier` | The output of the `from` node. If this value is "*", then all outputs of the `from` node are passed to the `to` node. If this value is undefined, then no data is passed to any inputs of the `to` node. |
| `to` | [`NodeIdentifier`](modules.md#nodeidentifier) | The node that the edge is going to. |

#### Defined in

[seeds/breadboard/src/types.ts:76](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L76)

___

### ErrorCapability

Ƭ **ErrorCapability**: [`Capability`](interfaces/Capability.md) & { `descriptor?`: [`NodeDescriptor`](modules.md#nodedescriptor) ; `error?`: `Error` ; `inputs?`: [`InputValues`](modules.md#inputvalues) ; `kind`: ``"error"``  }

#### Defined in

[seeds/breadboard/src/types.ts:13](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L13)

___

### GenericKit

Ƭ **GenericKit**<`T`\>: [`Kit`](interfaces/Kit.md) & { [key in keyof T]: NodeSugar<unknown, unknown\> }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`NodeHandlers`](modules.md#nodehandlers)<[`NodeHandlerContext`](interfaces/NodeHandlerContext.md)\> |

#### Defined in

[seeds/breadboard/src/types.ts:384](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L384)

___

### GraphDescriptor

Ƭ **GraphDescriptor**: [`GraphMetadata`](modules.md#graphmetadata) & { `args?`: [`InputValues`](modules.md#inputvalues) ; `edges`: [`Edge`](modules.md#edge)[] ; `graphs?`: [`SubGraphs`](modules.md#subgraphs) ; `kits?`: [`KitReference`](modules.md#kitreference)[] ; `nodes`: [`NodeDescriptor`](modules.md#nodedescriptor)[]  }

Represents a graph.

#### Defined in

[seeds/breadboard/src/types.ts:183](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L183)

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

[seeds/breadboard/src/types.ts:145](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L145)

___

### InputValues

Ƭ **InputValues**: `Record`<`InputIdentifier`, [`NodeValue`](modules.md#nodevalue)\>

Values that are supplied as inputs to the `NodeHandler`.

#### Defined in

[seeds/breadboard/src/types.ts:246](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L246)

___

### KitDescriptor

Ƭ **KitDescriptor**: [`KitReference`](modules.md#kitreference) & { `description?`: `string` ; `title?`: `string` ; `version?`: `string`  }

#### Defined in

[seeds/breadboard/src/types.ts:126](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L126)

___

### KitReference

Ƭ **KitReference**: `Object`

Represents references to a "kit": a collection of `NodeHandlers`.
The basic permise here is that people can publish kits with interesting
handlers, and then graphs can specify which ones they use.
The `@google-labs/llm-starter` package is an example of kit.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `url` | `string` | The URL pointing to the location of the kit. |

#### Defined in

[seeds/breadboard/src/types.ts:119](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L119)

___

### LambdaFunction

Ƭ **LambdaFunction**<`In`, `Out`\>: (`board`: `Breadboard`, `input`: [`BreadboardNode`](interfaces/BreadboardNode.md)<`In`, `Out`\>, `output`: [`BreadboardNode`](interfaces/BreadboardNode.md)<`In`, `Out`\>) => `void`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | [`InputValues`](modules.md#inputvalues) |
| `Out` | [`OutputValues`](modules.md#outputvalues) |

#### Type declaration

▸ (`board`, `input`, `output`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `board` | `Breadboard` |
| `input` | [`BreadboardNode`](interfaces/BreadboardNode.md)<`In`, `Out`\> |
| `output` | [`BreadboardNode`](interfaces/BreadboardNode.md)<`In`, `Out`\> |

##### Returns

`void`

#### Defined in

[seeds/breadboard/src/types.ts:629](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L629)

___

### NodeConfiguration

Ƭ **NodeConfiguration**: `Record`<`string`, [`NodeValue`](modules.md#nodevalue)\>

Values that are supplied as part of the graph. These values are merged with
the `InputValues` and supplied as inputs to the `NodeHandler`.

#### Defined in

[seeds/breadboard/src/types.ts:257](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L257)

___

### NodeConfigurationConstructor

Ƭ **NodeConfigurationConstructor**: `Record`<`string`, [`NodeValue`](modules.md#nodevalue) \| [`BreadboardNode`](interfaces/BreadboardNode.md)<[`InputValues`](modules.md#inputvalues), [`OutputValues`](modules.md#outputvalues)\>\>

A node configuration that optionally has nodes as values. The Node()
constructor will remove those and turn them into wires into the node instead.

#### Defined in

[seeds/breadboard/src/types.ts:600](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L600)

___

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

| Name | Type |
| :------ | :------ |
| `inputs?` | [`InputValues`](modules.md#inputvalues) |
| `inputSchema?` | [`Schema`](interfaces/Schema.md) |
| `outputSchema?` | [`Schema`](interfaces/Schema.md) |

##### Returns

`Promise`<[`NodeDescriberResult`](modules.md#nodedescriberresult)\>

#### Defined in

[seeds/breadboard/src/types.ts:298](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L298)

___

### NodeDescriberResult

Ƭ **NodeDescriberResult**: `Object`

The result of running `NodeDescriptorFunction`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `inputSchema` | [`Schema`](interfaces/Schema.md) |
| `outputSchema` | [`Schema`](interfaces/Schema.md) |

#### Defined in

[seeds/breadboard/src/types.ts:284](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L284)

___

### NodeDescriptor

Ƭ **NodeDescriptor**: `Object`

Represents a node in a graph.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `configuration?` | [`NodeConfiguration`](modules.md#nodeconfiguration) | Configuration of the node. |
| `id` | [`NodeIdentifier`](modules.md#nodeidentifier) | Unique id of the node in graph. |
| `type` | [`NodeTypeIdentifier`](modules.md#nodetypeidentifier) | Type of the node. Used to look up the handler for the node. |

#### Defined in

[seeds/breadboard/src/types.ts:56](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L56)

___

### NodeHandler

Ƭ **NodeHandler**<`Context`\>: { `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `invoke`: [`NodeHandlerFunction`](modules.md#nodehandlerfunction)<`Context`\>  } \| [`NodeHandlerFunction`](modules.md#nodehandlerfunction)<`Context`\>

#### Type parameters

| Name |
| :------ |
| `Context` |

#### Defined in

[seeds/breadboard/src/types.ts:304](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L304)

___

### NodeHandlerFunction

Ƭ **NodeHandlerFunction**<`T`\>: (`inputs`: [`InputValues`](modules.md#inputvalues), `context`: `T`) => `Promise`<[`OutputValues`](modules.md#outputvalues) \| `void`\>

#### Type parameters

| Name |
| :------ |
| `T` |

#### Type declaration

▸ (`inputs`, `context`): `Promise`<[`OutputValues`](modules.md#outputvalues) \| `void`\>

A function that represents a type of a node in the graph.

##### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`InputValues`](modules.md#inputvalues) |
| `context` | `T` |

##### Returns

`Promise`<[`OutputValues`](modules.md#outputvalues) \| `void`\>

#### Defined in

[seeds/breadboard/src/types.ts:262](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L262)

___

### NodeHandlers

Ƭ **NodeHandlers**<`T`\>: `ReservedNodeNames` & `Record`<[`NodeTypeIdentifier`](modules.md#nodetypeidentifier), [`NodeHandler`](modules.md#nodehandler)<`T`\>\>

All known node handlers.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `object` |

#### Defined in

[seeds/breadboard/src/types.ts:314](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L314)

___

### NodeIdentifier

Ƭ **NodeIdentifier**: `string`

Unique identifier of a node in a graph.

#### Defined in

[seeds/breadboard/src/types.ts:36](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L36)

___

### NodeTypeIdentifier

Ƭ **NodeTypeIdentifier**: `string`

Unique identifier of a node's type.

#### Defined in

[seeds/breadboard/src/types.ts:51](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L51)

___

### NodeValue

Ƭ **NodeValue**: `string` \| `number` \| `boolean` \| ``null`` \| `undefined` \| [`NodeValue`](modules.md#nodevalue)[] \| [`Capability`](interfaces/Capability.md) \| { `[key: string]`: [`NodeValue`](modules.md#nodevalue);  }

A type representing a valid JSON value.

#### Defined in

[seeds/breadboard/src/types.ts:23](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L23)

___

### OptionalIdConfiguration

Ƭ **OptionalIdConfiguration**: { `$id?`: `string`  } & [`NodeConfigurationConstructor`](modules.md#nodeconfigurationconstructor)

A node configuration that can optionally have an `$id` property.

The `$id` property is used to identify the node in the board and is not
passed to the node itself.

#### Defined in

[seeds/breadboard/src/types.ts:592](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L592)

___

### OutputValues

Ƭ **OutputValues**: `Partial`<`Record`<`OutputIdentifier`, [`NodeValue`](modules.md#nodevalue)\>\>

Values that the `NodeHandler` outputs.

#### Defined in

[seeds/breadboard/src/types.ts:251](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L251)

___

### ProbeEvent

Ƭ **ProbeEvent**: `CustomEvent`<`ProbeDetails`\>

A probe event that is distpached during board run.

See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) for more information.

#### Defined in

[seeds/breadboard/src/types.ts:467](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L467)

___

### RunResultType

Ƭ **RunResultType**: ``"input"`` \| ``"output"`` \| ``"beforehandler"``

#### Defined in

[seeds/breadboard/src/types.ts:323](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L323)

___

### SubGraphs

Ƭ **SubGraphs**: `Record`<`GraphIdentifier`, [`GraphDescriptor`](modules.md#graphdescriptor)\>

Represents a collection of sub-graphs.
The key is the identifier of the sub-graph.
The value is the descriptor of the sub-graph.

#### Defined in

[seeds/breadboard/src/types.ts:178](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L178)

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

[seeds/breadboard/src/mermaid.ts:201](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/mermaid.ts#L201)
