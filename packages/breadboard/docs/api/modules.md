[@google-labs/breadboard](README.md) / Exports

# @google-labs/breadboard

## Table of contents

### Classes

- [AbstractNode](classes/AbstractNode.md)
- [Board](classes/Board.md)
- [BoardRunner](classes/BoardRunner.md)
- [DebugProbe](classes/DebugProbe.md)
- [LogProbe](classes/LogProbe.md)
- [MachineResult](classes/MachineResult.md)
- [Node](classes/Node.md)
- [RunResult](classes/RunResult.md)
- [Runner](classes/Runner.md)
- [SchemaBuilder](classes/SchemaBuilder.md)
- [StreamCapability](classes/StreamCapability.md)
- [TraversalMachine](classes/TraversalMachine.md)
- [V](classes/V.md)

### Interfaces

- [BreadboardNode](interfaces/BreadboardNode.md)
- [BreadboardRunResult](interfaces/BreadboardRunResult.md)
- [BreadboardRunner](interfaces/BreadboardRunner.md)
- [BreadboardValidator](interfaces/BreadboardValidator.md)
- [BreadboardValidatorMetadata](interfaces/BreadboardValidatorMetadata.md)
- [Capability](interfaces/Capability.md)
- [Kit](interfaces/Kit.md)
- [KitConstructor](interfaces/KitConstructor.md)
- [NodeFactory](interfaces/NodeFactory.md)
- [NodeHandlerContext](interfaces/NodeHandlerContext.md)
- [Serializeable](interfaces/Serializeable.md)
- [StreamCapabilityType](interfaces/StreamCapabilityType.md)
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
- [InputsForGraphDeclaration](modules.md#inputsforgraphdeclaration)
- [InputsForHandler](modules.md#inputsforhandler)
- [InputsMaybeAsValues](modules.md#inputsmaybeasvalues)
- [KitDescriptor](modules.md#kitdescriptor)
- [KitReference](modules.md#kitreference)
- [Lambda](modules.md#lambda)
- [LambdaFunction](modules.md#lambdafunction)
- [LambdaNodeInputs](modules.md#lambdanodeinputs)
- [LambdaNodeOutputs](modules.md#lambdanodeoutputs)
- [NewInputValues](modules.md#newinputvalues)
- [NewInputValuesWithNodeFactory](modules.md#newinputvalueswithnodefactory)
- [NewNodeFactory](modules.md#newnodefactory)
- [NewNodeValue](modules.md#newnodevalue)
- [NewOutputValues](modules.md#newoutputvalues)
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
- [OutputValuesOrUnknown](modules.md#outputvaluesorunknown)
- [OutputsForGraphDeclaration](modules.md#outputsforgraphdeclaration)
- [OutputsMaybeAsValues](modules.md#outputsmaybeasvalues)
- [PatchedReadableStream](modules.md#patchedreadablestream)
- [ProbeEvent](modules.md#probeevent)
- [RunResultType](modules.md#runresulttype)
- [Schema](modules.md#schema)
- [SubGraphs](modules.md#subgraphs)
- [\_\_NodeProxy](modules.md#__nodeproxy)
- [\_\_ProjectBackToOutputValues](modules.md#__projectbacktooutputvalues)

### Variables

- [base](modules.md#base)

### Functions

- [addKit](modules.md#addkit)
- [asRuntimeKit](modules.md#asruntimekit)
- [asyncGen](modules.md#asyncgen)
- [callHandler](modules.md#callhandler)
- [isStreamCapability](modules.md#isstreamcapability)
- [patchReadableStream](modules.md#patchreadablestream)
- [recipe](modules.md#recipe)
- [recipeAsCode](modules.md#recipeascode)
- [recipeAsCodeWithZod](modules.md#recipeascodewithzod)
- [recipeAsGraph](modules.md#recipeasgraph)
- [recipeAsGraphWithZod](modules.md#recipeasgraphwithzod)
- [streamFromAsyncGen](modules.md#streamfromasyncgen)
- [toMermaid](modules.md#tomermaid)
- [zRecipe](modules.md#zrecipe)

## Type Aliases

### BreadboardCapability

Ƭ **BreadboardCapability**: [`Capability`](interfaces/Capability.md) & \{ `board`: [`GraphDescriptor`](modules.md#graphdescriptor) ; `kind`: ``"board"``  }

#### Defined in

[packages/breadboard/src/types.ts:525](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L525)

___

### BreadboardSlotSpec

Ƭ **BreadboardSlotSpec**: `Record`\<`string`, [`GraphDescriptor`](modules.md#graphdescriptor)\>

#### Defined in

[packages/breadboard/src/types.ts:342](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L342)

___

### ConfigOrLambda

Ƭ **ConfigOrLambda**\<`In`, `Out`\>: [`OptionalIdConfiguration`](modules.md#optionalidconfiguration) \| [`BreadboardCapability`](modules.md#breadboardcapability) \| [`BreadboardNode`](interfaces/BreadboardNode.md)\<[`LambdaNodeInputs`](modules.md#lambdanodeinputs), [`LambdaNodeOutputs`](modules.md#lambdanodeoutputs)\> \| [`GraphDescriptor`](modules.md#graphdescriptor) \| [`LambdaFunction`](modules.md#lambdafunction)\<`In`, `Out`\> \| \{ `board`: [`BreadboardCapability`](modules.md#breadboardcapability) \| [`BreadboardNode`](interfaces/BreadboardNode.md)\<[`LambdaNodeInputs`](modules.md#lambdanodeinputs), [`LambdaNodeOutputs`](modules.md#lambdanodeoutputs)\> \| [`LambdaFunction`](modules.md#lambdafunction)\<`In`, `Out`\>  }

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

[packages/breadboard/src/types.ts:627](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L627)

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

[packages/breadboard/src/types.ts:97](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L97)

___

### ErrorCapability

Ƭ **ErrorCapability**: [`Capability`](interfaces/Capability.md) & \{ `descriptor?`: [`NodeDescriptor`](modules.md#nodedescriptor) ; `error?`: `Error` ; `inputs?`: [`InputValues`](modules.md#inputvalues) ; `kind`: ``"error"``  }

#### Defined in

[packages/breadboard/src/types.ts:34](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L34)

___

### GenericKit

Ƭ **GenericKit**\<`T`\>: [`Kit`](interfaces/Kit.md) & \{ [key in keyof T]: NodeSugar\<unknown, unknown\> }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`NodeHandlers`](modules.md#nodehandlers) |

#### Defined in

[packages/breadboard/src/types.ts:405](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L405)

___

### GraphDescriptor

Ƭ **GraphDescriptor**: [`GraphMetadata`](modules.md#graphmetadata) & \{ `args?`: [`InputValues`](modules.md#inputvalues) ; `edges`: [`Edge`](modules.md#edge)[] ; `graphs?`: [`SubGraphs`](modules.md#subgraphs) ; `kits?`: [`KitReference`](modules.md#kitreference)[] ; `nodes`: [`NodeDescriptor`](modules.md#nodedescriptor)[]  }

Represents a graph.

#### Defined in

[packages/breadboard/src/types.ts:204](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L204)

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

[packages/breadboard/src/types.ts:166](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L166)

___

### InputValues

Ƭ **InputValues**: `Record`\<`InputIdentifier`, [`NodeValue`](modules.md#nodevalue)\>

Values that are supplied as inputs to the `NodeHandler`.

#### Defined in

[packages/breadboard/src/types.ts:267](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L267)

___

### InputsForGraphDeclaration

Ƭ **InputsForGraphDeclaration**\<`T`\>: \{ [K in keyof T]: V\<T[K]\> & Function } & \{ [key in string]: V\<NodeValue\> }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:82](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L82)

___

### InputsForHandler

Ƭ **InputsForHandler**\<`T`\>: \{ [K in keyof T]: V\<T[K]\> & PromiseLike\<T[K]\> & Function } & \{ [key in string]: V\<NodeValue\> & PromiseLike\<NodeValue\> } & `PromiseLike`\<`T`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:74](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L74)

___

### InputsMaybeAsValues

Ƭ **InputsMaybeAsValues**\<`T`, `NI`\>: `Partial`\<\{ [K in keyof T]: V\<T[K]\> \| \_\_NodeProxy\<NI, OutputValue\<T[K]\>\> \| T[K] }\> & \{ [key in string]: V\<NodeValue\> \| \_\_NodeProxy\<NI, Partial\<NewInputValuesWithNodeFactory\>\> \| NodeValue }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `NI` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:31](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L31)

___

### KitDescriptor

Ƭ **KitDescriptor**: [`KitReference`](modules.md#kitreference) & \{ `description?`: `string` ; `title?`: `string` ; `version?`: `string`  }

#### Defined in

[packages/breadboard/src/types.ts:147](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L147)

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

[packages/breadboard/src/types.ts:140](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L140)

___

### Lambda

Ƭ **Lambda**\<`I`, `O`\>: [`NewNodeFactory`](modules.md#newnodefactory)\<`I`, `O`\> & [`Serializeable`](interfaces/Serializeable.md) & `ClosureNodeInterface`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `O` | extends `OutputValues` = `OutputValues` |

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:121](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L121)

___

### LambdaFunction

Ƭ **LambdaFunction**\<`In`, `Out`\>: (`board`: `Breadboard`, `input`: [`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\>, `output`: [`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\>) => `void`

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
| `input` | [`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\> |
| `output` | [`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\> |

##### Returns

`void`

#### Defined in

[packages/breadboard/src/types.ts:640](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L640)

___

### LambdaNodeInputs

Ƭ **LambdaNodeInputs**: [`InputValues`](modules.md#inputvalues) & \{ `args`: [`InputValues`](modules.md#inputvalues) ; `board`: [`BreadboardCapability`](modules.md#breadboardcapability)  }

#### Defined in

[packages/breadboard/src/types.ts:646](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L646)

___

### LambdaNodeOutputs

Ƭ **LambdaNodeOutputs**: [`OutputValues`](modules.md#outputvalues) & \{ `board`: [`BreadboardCapability`](modules.md#breadboardcapability)  }

#### Defined in

[packages/breadboard/src/types.ts:662](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L662)

___

### NewInputValues

Ƭ **NewInputValues**: `Object`

#### Index signature

▪ [key: `string`]: [`NewNodeValue`](modules.md#newnodevalue)

#### Defined in

[packages/breadboard/src/new/runner/types.ts:22](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L22)

___

### NewInputValuesWithNodeFactory

Ƭ **NewInputValuesWithNodeFactory**: `Object`

#### Index signature

▪ [key: `string`]: `NodeValue`

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:28](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L28)

___

### NewNodeFactory

Ƭ **NewNodeFactory**\<`I`, `O`\>: (`config?`: [`AbstractNode`](classes/AbstractNode.md)\<[`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory), `I`\> \| [`V`](classes/V.md)\<`NodeValue`\> \| [`InputsMaybeAsValues`](modules.md#inputsmaybeasvalues)\<`I`\>) => [`__NodeProxy`](modules.md#__nodeproxy)\<`I`, `O`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `O` | extends [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown) = [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown) |

#### Type declaration

▸ (`config?`): [`__NodeProxy`](modules.md#__nodeproxy)\<`I`, `O`\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `config?` | [`AbstractNode`](classes/AbstractNode.md)\<[`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory), `I`\> \| [`V`](classes/V.md)\<`NodeValue`\> \| [`InputsMaybeAsValues`](modules.md#inputsmaybeasvalues)\<`I`\> |

##### Returns

[`__NodeProxy`](modules.md#__nodeproxy)\<`I`, `O`\>

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:64](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L64)

___

### NewNodeValue

Ƭ **NewNodeValue**: [`NodeValue`](modules.md#nodevalue) \| `PromiseLike`\<[`NewNodeValue`](modules.md#newnodevalue)\> \| `unknown`

#### Defined in

[packages/breadboard/src/new/runner/types.ts:19](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L19)

___

### NewOutputValues

Ƭ **NewOutputValues**: `Object`

#### Index signature

▪ [key: `string`]: [`NewNodeValue`](modules.md#newnodevalue)

#### Defined in

[packages/breadboard/src/new/runner/types.ts:24](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L24)

___

### NodeConfiguration

Ƭ **NodeConfiguration**: `Record`\<`string`, [`NodeValue`](modules.md#nodevalue)\>

Values that are supplied as part of the graph. These values are merged with
the `InputValues` and supplied as inputs to the `NodeHandler`.

#### Defined in

[packages/breadboard/src/types.ts:278](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L278)

___

### NodeConfigurationConstructor

Ƭ **NodeConfigurationConstructor**: `Record`\<`string`, [`NodeValue`](modules.md#nodevalue) \| [`BreadboardNode`](interfaces/BreadboardNode.md)\<[`InputValues`](modules.md#inputvalues), [`OutputValues`](modules.md#outputvalues)\>\>

A node configuration that optionally has nodes as values. The Node()
constructor will remove those and turn them into wires into the node instead.

#### Defined in

[packages/breadboard/src/types.ts:611](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L611)

___

### NodeDescriberFunction

Ƭ **NodeDescriberFunction**: (`inputs?`: [`InputValues`](modules.md#inputvalues), `inputSchema?`: [`Schema`](modules.md#schema), `outputSchema?`: [`Schema`](modules.md#schema)) => `Promise`\<[`NodeDescriberResult`](modules.md#nodedescriberresult)\>

#### Type declaration

▸ (`inputs?`, `inputSchema?`, `outputSchema?`): `Promise`\<[`NodeDescriberResult`](modules.md#nodedescriberresult)\>

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
| `inputSchema?` | [`Schema`](modules.md#schema) |
| `outputSchema?` | [`Schema`](modules.md#schema) |

##### Returns

`Promise`\<[`NodeDescriberResult`](modules.md#nodedescriberresult)\>

#### Defined in

[packages/breadboard/src/types.ts:319](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L319)

___

### NodeDescriberResult

Ƭ **NodeDescriberResult**: `Object`

The result of running `NodeDescriptorFunction`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `inputSchema` | [`Schema`](modules.md#schema) |
| `outputSchema` | [`Schema`](modules.md#schema) |

#### Defined in

[packages/breadboard/src/types.ts:305](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L305)

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

[packages/breadboard/src/types.ts:77](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L77)

___

### NodeHandler

Ƭ **NodeHandler**: \{ `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `invoke`: [`NodeHandlerFunction`](modules.md#nodehandlerfunction)  } \| [`NodeHandlerFunction`](modules.md#nodehandlerfunction)

#### Defined in

[packages/breadboard/src/types.ts:325](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L325)

___

### NodeHandlerFunction

Ƭ **NodeHandlerFunction**: (`inputs`: [`InputValues`](modules.md#inputvalues), `context`: [`NodeHandlerContext`](interfaces/NodeHandlerContext.md)) => `Promise`\<[`OutputValues`](modules.md#outputvalues) \| `void`\>

#### Type declaration

▸ (`inputs`, `context`): `Promise`\<[`OutputValues`](modules.md#outputvalues) \| `void`\>

A function that represents a type of a node in the graph.

##### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`InputValues`](modules.md#inputvalues) |
| `context` | [`NodeHandlerContext`](interfaces/NodeHandlerContext.md) |

##### Returns

`Promise`\<[`OutputValues`](modules.md#outputvalues) \| `void`\>

#### Defined in

[packages/breadboard/src/types.ts:283](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L283)

___

### NodeHandlers

Ƭ **NodeHandlers**: `ReservedNodeNames` & `Record`\<[`NodeTypeIdentifier`](modules.md#nodetypeidentifier), [`NodeHandler`](modules.md#nodehandler)\>

All known node handlers.

#### Defined in

[packages/breadboard/src/types.ts:335](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L335)

___

### NodeIdentifier

Ƭ **NodeIdentifier**: `string`

Unique identifier of a node in a graph.

#### Defined in

[packages/breadboard/src/types.ts:57](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L57)

___

### NodeTypeIdentifier

Ƭ **NodeTypeIdentifier**: `string`

Unique identifier of a node's type.

#### Defined in

[packages/breadboard/src/types.ts:72](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L72)

___

### NodeValue

Ƭ **NodeValue**: `string` \| `number` \| `boolean` \| ``null`` \| `undefined` \| [`NodeValue`](modules.md#nodevalue)[] \| [`Capability`](interfaces/Capability.md) \| \{ `[key: string]`: [`NodeValue`](modules.md#nodevalue);  }

A type representing a valid JSON value.

#### Defined in

[packages/breadboard/src/types.ts:44](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L44)

___

### OptionalIdConfiguration

Ƭ **OptionalIdConfiguration**: \{ `$id?`: `string`  } & [`NodeConfigurationConstructor`](modules.md#nodeconfigurationconstructor)

A node configuration that can optionally have an `$id` property.

The `$id` property is used to identify the node in the board and is not
passed to the node itself.

#### Defined in

[packages/breadboard/src/types.ts:603](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L603)

___

### OutputValues

Ƭ **OutputValues**: `Partial`\<`Record`\<`OutputIdentifier`, [`NodeValue`](modules.md#nodevalue)\>\>

Values that the `NodeHandler` outputs.

#### Defined in

[packages/breadboard/src/types.ts:272](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L272)

___

### OutputValuesOrUnknown

Ƭ **OutputValuesOrUnknown**: `Object`

#### Index signature

▪ [key: `string`]: `NodeValue` \| `unknown`

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:59](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L59)

___

### OutputsForGraphDeclaration

Ƭ **OutputsForGraphDeclaration**\<`T`, `NI`\>: \{ [K in keyof T]: V\<T[K]\> \| \_\_NodeProxy\<NI, OutputValue\<T[K]\>\> } & \{ [key in string]: V\<NodeValue\> \| \_\_NodeProxy\<NI, Partial\<NewInputValuesWithNodeFactory\>\> } \| `PromiseLike`\<[`OutputsMaybeAsValues`](modules.md#outputsmaybeasvalues)\<`T`\>\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown) |
| `NI` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:89](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L89)

___

### OutputsMaybeAsValues

Ƭ **OutputsMaybeAsValues**\<`T`, `NI`\>: `Partial`\<\{ [K in keyof T]: V\<T[K]\> \| \_\_NodeProxy\<NI, OutputValue\<T[K]\>\> \| T[K] \| unknown }\> & \{ [key in string]: V\<NodeValue\> \| \_\_NodeProxy\<NI, Partial\<NewInputValuesWithNodeFactory\>\> \| NodeValue }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown) |
| `NI` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:43](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L43)

___

### PatchedReadableStream

Ƭ **PatchedReadableStream**\<`T`\>: `ReadableStream`\<`T`\> & `AsyncIterable`\<`T`\>

#### Type parameters

| Name |
| :------ |
| `T` |

#### Defined in

[packages/breadboard/src/stream.ts:60](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/stream.ts#L60)

___

### ProbeEvent

Ƭ **ProbeEvent**: `CustomEvent`\<`ProbeDetails`\>

A probe event that is distpached during board run.

See [Chapter 7: Probes](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard/docs/tutorial#chapter-7-probes) for more information.

#### Defined in

[packages/breadboard/src/types.ts:488](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L488)

___

### RunResultType

Ƭ **RunResultType**: ``"input"`` \| ``"output"`` \| ``"beforehandler"``

#### Defined in

[packages/breadboard/src/types.ts:344](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L344)

___

### Schema

Ƭ **Schema**: `Object`

**`License`**

Copyright 2023 Google LLC
SPDX-License-Identifier: Apache-2.0

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `additionalProperties?` | `boolean` \| [`Schema`](modules.md#schema) | - |
| `default?` | `string` | The default value of the schema. The UI can use this to pre-populate a field with a value, if there is no `examples` present. |
| `description?` | `string` | - |
| `enum?` | `string`[] | - |
| `examples?` | `string`[] | Can be used by UI to pre-populate a field with a value that could be used as an example. |
| `format?` | `string` | - |
| `items?` | [`Schema`](modules.md#schema) \| [`Schema`](modules.md#schema)[] | - |
| `minItems?` | `number` | - |
| `properties?` | `Record`\<`string`, [`Schema`](modules.md#schema)\> | - |
| `required?` | `string`[] | - |
| `title?` | `string` | - |
| `type?` | `string` \| `string`[] | - |

#### Defined in

[packages/breadboard/src/types.ts:7](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L7)

___

### SubGraphs

Ƭ **SubGraphs**: `Record`\<`GraphIdentifier`, [`GraphDescriptor`](modules.md#graphdescriptor)\>

Represents a collection of sub-graphs.
The key is the identifier of the sub-graph.
The value is the descriptor of the sub-graph.

#### Defined in

[packages/breadboard/src/types.ts:199](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L199)

___

### \_\_NodeProxy

Ƭ **\_\_NodeProxy**\<`I`, `O`\>: \{ [K in keyof O]: V\<O[K]\> & Function } & \{ [key in string]: V\<NodeValue\> & Function } & `NodeProxyMethods`\<`I`, `O`\>

Intersection between a Node and a Promise for its output:
 - Has all the output fields as Value<T> instances.
 - Has all the methods of the NodeProxyInterface defined above.
 - Including then() which makes it a PromiseLike<O>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `O` | extends `OutputValues` = `OutputValues` |

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:286](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L286)

___

### \_\_ProjectBackToOutputValues

Ƭ **\_\_ProjectBackToOutputValues**\<`O`\>: \{ [K in keyof O]: O[K] extends NodeValue ? O[K] : NodeValue }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `O` | extends [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown) |

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:60](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L60)

## Variables

### base

• `Const` **base**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `input` | \<T\>(`config`: \{ `$id?`: `string` ; `schema`: `T`  } & `Partial`\<\{ [K in string \| number \| symbol]: TypeOf\<T\>[K] \| V\<TypeOf\<T\>[K]\> \| \_\_NodeProxy\<NewInputValuesWithNodeFactory, Partial\<Object\>\> }\> & {}) => [`__NodeProxy`](modules.md#__nodeproxy)\<`Record`\<`string`, `never`\>, `TypeOf`\<`T`\>\> & (`config`: \{ `$id?`: `string` ; `schema?`: [`Schema`](modules.md#schema)  } & `Partial`\<{}\> & {}) => [`__NodeProxy`](modules.md#__nodeproxy)\<[`NewInputValues`](modules.md#newinputvalues), [`NewOutputValues`](modules.md#newoutputvalues)\> |
| `output` | \<T\>(`config`: \{ `$id?`: `string` ; `schema`: `T`  } & `Partial`\<\{ [K in string \| number \| symbol]: TypeOf\<T\>[K] \| V\<TypeOf\<T\>[K]\> \| \_\_NodeProxy\<NewInputValuesWithNodeFactory, Partial\<Object\>\> }\> & {}) => [`__NodeProxy`](modules.md#__nodeproxy)\<`TypeOf`\<`T`\>, `Record`\<`string`, `never`\>\> & (`config`: \{ `$id?`: `string` ; `schema?`: [`Schema`](modules.md#schema)  } & `Partial`\<{}\> & {}) => [`__NodeProxy`](modules.md#__nodeproxy)\<[`NewInputValues`](modules.md#newinputvalues), `Record`\<`string`, `never`\>\> |

#### Defined in

[packages/breadboard/src/new/recipe-grammar/base.ts:31](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/base.ts#L31)

## Functions

### addKit

▸ **addKit**\<`T`\>(`ctr`, `namespacePrefix?`): `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Kit`](interfaces/Kit.md) |

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `ctr` | [`KitConstructor`](interfaces/KitConstructor.md)\<`T`\> | `undefined` |
| `namespacePrefix` | `string` | `""` |

#### Returns

`Object`

#### Defined in

[packages/breadboard/src/new/recipe-grammar/kits.ts:38](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/kits.ts#L38)

___

### asRuntimeKit

▸ **asRuntimeKit**(`ctor`): [`Kit`](interfaces/Kit.md)

Takes a kit constructor and creates a kit instance that can be used at
run-time.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `ctor` | [`KitConstructor`](interfaces/KitConstructor.md)\<[`Kit`](interfaces/Kit.md)\> | Kit constructor |

#### Returns

[`Kit`](interfaces/Kit.md)

A kit instance prepare for run-time use.

#### Defined in

[packages/breadboard/src/kits/ctors.ts:29](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/kits/ctors.ts#L29)

___

### asyncGen

▸ **asyncGen**\<`T`\>(`callback`): `Object`

Converts async/await style code into an async generator.
Useful when you need to combine arrow-style functions and yield.

Example:

```ts
async function* foo() {
  yield 1;
  yield* asyncGen(async (next) => {
    await next(2);
    await next(3);
  });
  yield 4;
}

for await (const val of foo()) {
  console.log(val);
}
```

This code will print:

```
1
2
3
4
```

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `callback` | `AsyncGenCallback`\<`T`\> | A callback that will be called with a `next` function. The callback should call `next` with the next value to yield. |

#### Returns

`Object`

An async generator.

| Name | Type |
| :------ | :------ |
| `[asyncIterator]` | () => `AsyncIterator`\<`T`, `void`, `unknown`\> |

#### Defined in

[packages/breadboard/src/utils/async-gen.ts:44](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/utils/async-gen.ts#L44)

___

### callHandler

▸ **callHandler**(`handler`, `inputs`, `context`): `Promise`\<`void` \| `Partial`\<`Record`\<`string`, [`NodeValue`](modules.md#nodevalue)\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`NodeHandler`](modules.md#nodehandler) |
| `inputs` | [`InputValues`](modules.md#inputvalues) |
| `context` | [`NodeHandlerContext`](interfaces/NodeHandlerContext.md) |

#### Returns

`Promise`\<`void` \| `Partial`\<`Record`\<`string`, [`NodeValue`](modules.md#nodevalue)\>\>\>

#### Defined in

[packages/breadboard/src/handler.ts:9](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/handler.ts#L9)

___

### isStreamCapability

▸ **isStreamCapability**(`object`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `object` | `unknown` |

#### Returns

`boolean`

#### Defined in

[packages/breadboard/src/stream.ts:27](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/stream.ts#L27)

___

### patchReadableStream

▸ **patchReadableStream**(): `void`

#### Returns

`void`

#### Defined in

[packages/breadboard/src/stream.ts:107](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/stream.ts#L107)

___

### recipe

▸ **recipe**\<`I`, `O`\>(`fn`): [`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

Implementation of the overloaded recipe function.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `O` | extends `OutputValues` = `OutputValues` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `fn` | `NodeProxyHandlerFunction`\<`I`, `O`\> |

#### Returns

[`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:137](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L137)

▸ **recipe**\<`IT`, `OT`\>(`options`): [`Lambda`](modules.md#lambda)\<`TypeOf`\<`IT`\>, `Required`\<`TypeOf`\<`OT`\>\>\>

Implementation of the overloaded recipe function.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `IT` | extends `ZodType`\<`any`, `ZodTypeDef`, `any`\> |
| `OT` | extends `ZodType`\<`any`, `ZodTypeDef`, `any`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | \{ `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `input`: `IT` ; `invoke`: (`inputs`: `TypeOf`\<`IT`\>) => `TypeOf`\<`OT`\> \| `PromiseLike`\<`TypeOf`\<`OT`\>\> ; `name?`: `string` ; `output`: `OT`  } & [`GraphMetadata`](modules.md#graphmetadata) |

#### Returns

[`Lambda`](modules.md#lambda)\<`TypeOf`\<`IT`\>, `Required`\<`TypeOf`\<`OT`\>\>\>

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:159](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L159)

▸ **recipe**\<`IT`, `OT`\>(`options`, `fn`): [`Lambda`](modules.md#lambda)\<`TypeOf`\<`IT`\>, `Required`\<`TypeOf`\<`OT`\>\>\>

Implementation of the overloaded recipe function.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `IT` | extends `ZodType`\<`any`, `ZodTypeDef`, `any`\> |
| `OT` | extends `ZodType`\<`any`, `ZodTypeDef`, `any`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | \{ `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `input`: `IT` ; `name?`: `string` ; `output`: `OT`  } & [`GraphMetadata`](modules.md#graphmetadata) |
| `fn` | `NodeProxyHandlerFunctionForGraphDeclaration`\<`TypeOf`\<`IT`\>, `TypeOf`\<`OT`\>\> |

#### Returns

[`Lambda`](modules.md#lambda)\<`TypeOf`\<`IT`\>, `Required`\<`TypeOf`\<`OT`\>\>\>

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:176](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L176)

___

### recipeAsCode

▸ **recipeAsCode**\<`I`, `O`\>(`fn`): [`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `O` | extends `OutputValues` = `OutputValues` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `fn` | (`inputs`: `I`) => `O` \| `PromiseLike`\<`O`\> |

#### Returns

[`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

#### Defined in

[packages/breadboard/src/new/recipe-grammar/recipe.ts:75](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/recipe.ts#L75)

___

### recipeAsCodeWithZod

▸ **recipeAsCodeWithZod**\<`IT`, `OT`\>(`options`): [`Lambda`](modules.md#lambda)\<`TypeOf`\<`IT`\>, `Required`\<`TypeOf`\<`OT`\>\>\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `IT` | extends `ZodType`\<`any`, `ZodTypeDef`, `any`\> |
| `OT` | extends `ZodType`\<`any`, `ZodTypeDef`, `any`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | \{ `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `fnType`: ``"code"`` ; `input`: `IT` ; `invoke`: (`inputs`: `TypeOf`\<`IT`\>) => `TypeOf`\<`OT`\> \| `PromiseLike`\<`TypeOf`\<`OT`\>\> ; `name?`: `string` ; `output`: `OT`  } & [`GraphMetadata`](modules.md#graphmetadata) |

#### Returns

[`Lambda`](modules.md#lambda)\<`TypeOf`\<`IT`\>, `Required`\<`TypeOf`\<`OT`\>\>\>

#### Defined in

[packages/breadboard/src/new/recipe-grammar/recipe.ts:106](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/recipe.ts#L106)

___

### recipeAsGraph

▸ **recipeAsGraph**\<`I`, `O`\>(`fn`): [`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

Explicit implementations of the overloaded variants, also splitting
graph generation and code recipes.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `O` | extends `OutputValues` = `OutputValues` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `fn` | `NodeProxyHandlerFunctionForGraphDeclaration`\<`I`, `O`\> |

#### Returns

[`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

#### Defined in

[packages/breadboard/src/new/recipe-grammar/recipe.ts:63](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/recipe.ts#L63)

___

### recipeAsGraphWithZod

▸ **recipeAsGraphWithZod**\<`IT`, `OT`\>(`options`, `fn`): [`Lambda`](modules.md#lambda)\<`TypeOf`\<`IT`\>, `Required`\<`TypeOf`\<`OT`\>\>\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `IT` | extends `ZodType`\<`any`, `ZodTypeDef`, `any`\> |
| `OT` | extends `ZodType`\<`any`, `ZodTypeDef`, `any`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | \{ `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `input`: `IT` ; `name?`: `string` ; `output`: `OT`  } & [`GraphMetadata`](modules.md#graphmetadata) |
| `fn` | `NodeProxyHandlerFunctionForGraphDeclaration`\<`TypeOf`\<`IT`\>, `TypeOf`\<`OT`\>\> |

#### Returns

[`Lambda`](modules.md#lambda)\<`TypeOf`\<`IT`\>, `Required`\<`TypeOf`\<`OT`\>\>\>

#### Defined in

[packages/breadboard/src/new/recipe-grammar/recipe.ts:87](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/recipe.ts#L87)

___

### streamFromAsyncGen

▸ **streamFromAsyncGen**\<`T`\>(`iterator`): [`PatchedReadableStream`](modules.md#patchedreadablestream)\<`T`\>

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `iterator` | `AsyncIterableIterator`\<`T`\> |

#### Returns

[`PatchedReadableStream`](modules.md#patchedreadablestream)\<`T`\>

#### Defined in

[packages/breadboard/src/stream.ts:130](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/stream.ts#L130)

___

### toMermaid

▸ **toMermaid**(`graph`, `direction?`, `unstyled?`): `string`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `graph` | [`GraphDescriptor`](modules.md#graphdescriptor) | `undefined` |
| `direction` | `string` | `"TD"` |
| `unstyled` | `boolean` | `false` |

#### Returns

`string`

#### Defined in

[packages/breadboard/src/mermaid.ts:192](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/mermaid.ts#L192)

___

### zRecipe

▸ **zRecipe**\<`IT`, `OT`\>(`options`, `fn?`): [`Lambda`](modules.md#lambda)\<`TypeOf`\<`IT`\>, `Required`\<`TypeOf`\<`OT`\>\>\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `IT` | extends `ZodType`\<`any`, `ZodTypeDef`, `any`\> |
| `OT` | extends `ZodType`\<`any`, `ZodTypeDef`, `any`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | \{ `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `input`: `IT` ; `invoke?`: (`inputs`: `TypeOf`\<`IT`\>) => `TypeOf`\<`OT`\> \| `PromiseLike`\<`TypeOf`\<`OT`\>\> ; `name?`: `string` ; `output`: `OT`  } & [`GraphMetadata`](modules.md#graphmetadata) |
| `fn?` | `NodeProxyHandlerFunctionForGraphDeclaration`\<`TypeOf`\<`IT`\>, `TypeOf`\<`OT`\>\> |

#### Returns

[`Lambda`](modules.md#lambda)\<`TypeOf`\<`IT`\>, `Required`\<`TypeOf`\<`OT`\>\>\>

#### Defined in

[packages/breadboard/src/new/recipe-grammar/recipe.ts:120](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/recipe.ts#L120)
