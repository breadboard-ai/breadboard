[@google-labs/breadboard](README.md) / Exports

# @google-labs/breadboard

## Table of contents

### References

- [recipe](modules.md#recipe)

### Classes

- [AbstractNode](classes/AbstractNode.md)
- [Board](classes/Board.md)
- [BoardRunner](classes/BoardRunner.md)
- [MachineResult](classes/MachineResult.md)
- [Node](classes/Node.md)
- [RunResult](classes/RunResult.md)
- [Runner](classes/Runner.md)
- [SchemaBuilder](classes/SchemaBuilder.md)
- [StreamCapability](classes/StreamCapability.md)
- [TraversalMachine](classes/TraversalMachine.md)
- [V](classes/V.md)

### Interfaces

- [Breadboard](interfaces/Breadboard.md)
- [BreadboardNode](interfaces/BreadboardNode.md)
- [BreadboardRunResult](interfaces/BreadboardRunResult.md)
- [BreadboardRunner](interfaces/BreadboardRunner.md)
- [BreadboardValidator](interfaces/BreadboardValidator.md)
- [BreadboardValidatorMetadata](interfaces/BreadboardValidatorMetadata.md)
- [Capability](interfaces/Capability.md)
- [CompletedNodeOutput](interfaces/CompletedNodeOutput.md)
- [Kit](interfaces/Kit.md)
- [KitConstructor](interfaces/KitConstructor.md)
- [NodeFactory](interfaces/NodeFactory.md)
- [NodeHandlerContext](interfaces/NodeHandlerContext.md)
- [Probe](interfaces/Probe.md)
- [QueuedNodeValuesState](interfaces/QueuedNodeValuesState.md)
- [RunnerLike](interfaces/RunnerLike.md)
- [Serializeable](interfaces/Serializeable.md)
- [StreamCapabilityType](interfaces/StreamCapabilityType.md)
- [TraversalResult](interfaces/TraversalResult.md)

### Type Aliases

- [BreadboardCapability](modules.md#breadboardcapability)
- [BreadboardSlotSpec](modules.md#breadboardslotspec)
- [ConfigOrLambda](modules.md#configorlambda)
- [Edge](modules.md#edge)
- [ErrorCapability](modules.md#errorcapability)
- [ErrorObject](modules.md#errorobject)
- [ErrorResponse](modules.md#errorresponse)
- [GenericKit](modules.md#generickit)
- [GraphDescriptor](modules.md#graphdescriptor)
- [GraphEndProbeMessage](modules.md#graphendprobemessage)
- [GraphIdentifier](modules.md#graphidentifier)
- [GraphMetadata](modules.md#graphmetadata)
- [GraphProbeData](modules.md#graphprobedata)
- [GraphStartProbeMessage](modules.md#graphstartprobemessage)
- [InputIdentifier](modules.md#inputidentifier)
- [InputResponse](modules.md#inputresponse)
- [InputValues](modules.md#inputvalues)
- [InputsForGraphDeclaration](modules.md#inputsforgraphdeclaration)
- [InputsForHandler](modules.md#inputsforhandler)
- [InputsMaybeAsValues](modules.md#inputsmaybeasvalues)
- [InvocationId](modules.md#invocationid)
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
- [NodeEndProbeMessage](modules.md#nodeendprobemessage)
- [NodeEndResponse](modules.md#nodeendresponse)
- [NodeHandler](modules.md#nodehandler)
- [NodeHandlerFunction](modules.md#nodehandlerfunction)
- [NodeHandlers](modules.md#nodehandlers)
- [NodeIdentifier](modules.md#nodeidentifier)
- [NodeStartProbeMessage](modules.md#nodestartprobemessage)
- [NodeStartResponse](modules.md#nodestartresponse)
- [NodeSugar](modules.md#nodesugar)
- [NodeTypeIdentifier](modules.md#nodetypeidentifier)
- [NodeValue](modules.md#nodevalue)
- [NodeValuesQueues](modules.md#nodevaluesqueues)
- [NodeValuesQueuesMap](modules.md#nodevaluesqueuesmap)
- [OptionalIdConfiguration](modules.md#optionalidconfiguration)
- [OutputIdentifier](modules.md#outputidentifier)
- [OutputResponse](modules.md#outputresponse)
- [OutputValues](modules.md#outputvalues)
- [OutputValuesOrUnknown](modules.md#outputvaluesorunknown)
- [OutputsForGraphDeclaration](modules.md#outputsforgraphdeclaration)
- [OutputsMaybeAsValues](modules.md#outputsmaybeasvalues)
- [PatchedReadableStream](modules.md#patchedreadablestream)
- [ProbeMessage](modules.md#probemessage)
- [ReservedNodeNames](modules.md#reservednodenames)
- [RunResultType](modules.md#runresulttype)
- [RunStackEntry](modules.md#runstackentry)
- [RunState](modules.md#runstate)
- [Schema](modules.md#schema)
- [SkipProbeMessage](modules.md#skipprobemessage)
- [SubGraphs](modules.md#subgraphs)
- [\_\_NodeProxy](modules.md#__nodeproxy)
- [\_\_ProjectBackToOutputValues](modules.md#__projectbacktooutputvalues)

### Variables

- [base](modules.md#base)

### Functions

- [addKit](modules.md#addkit)
- [asRuntimeKit](modules.md#asruntimekit)
- [asyncGen](modules.md#asyncgen)
- [board](modules.md#board)
- [callHandler](modules.md#callhandler)
- [clone](modules.md#clone)
- [code](modules.md#code)
- [isStreamCapability](modules.md#isstreamcapability)
- [patchReadableStream](modules.md#patchreadablestream)
- [streamFromAsyncGen](modules.md#streamfromasyncgen)
- [toMermaid](modules.md#tomermaid)
- [traversalResultFromStack](modules.md#traversalresultfromstack)

## References

### recipe

Renames and re-exports [board](modules.md#board)

## Type Aliases

### BreadboardCapability

Ƭ **BreadboardCapability**: [`Capability`](interfaces/Capability.md) & \{ `board`: [`GraphDescriptor`](modules.md#graphdescriptor) ; `kind`: ``"board"``  }

#### Defined in

[packages/breadboard/src/types.ts:673](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L673)

___

### BreadboardSlotSpec

Ƭ **BreadboardSlotSpec**: `Record`\<`string`, [`GraphDescriptor`](modules.md#graphdescriptor)\>

#### Defined in

[packages/breadboard/src/types.ts:348](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L348)

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

[packages/breadboard/src/types.ts:744](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L744)

___

### Edge

Ƭ **Edge**: `Object`

Represents an edge in a graph.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `constant?` | `boolean` | If true, this edge acts as a constant: the data that passes through it remains available even after the node has consumed it. |
| `from` | [`NodeIdentifier`](modules.md#nodeidentifier) | The node that the edge is coming from. |
| `in?` | [`InputIdentifier`](modules.md#inputidentifier) | The input of the `to` node. If this value is undefined, then the then no data is passed as output of the `from` node. |
| `optional?` | `boolean` | If true, this edge is optional: the data that passes through it is not considered a required input to the node. |
| `out?` | [`OutputIdentifier`](modules.md#outputidentifier) | The output of the `from` node. If this value is "*", then all outputs of the `from` node are passed to the `to` node. If this value is undefined, then no data is passed to any inputs of the `to` node. |
| `to` | [`NodeIdentifier`](modules.md#nodeidentifier) | The node that the edge is going to. |

#### Defined in

[packages/breadboard/src/types.ts:98](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L98)

___

### ErrorCapability

Ƭ **ErrorCapability**: [`Capability`](interfaces/Capability.md) & \{ `descriptor?`: [`NodeDescriptor`](modules.md#nodedescriptor) ; `error?`: `Error` ; `inputs?`: [`InputValues`](modules.md#inputvalues) ; `kind`: ``"error"``  }

#### Defined in

[packages/breadboard/src/types.ts:35](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L35)

___

### ErrorObject

Ƭ **ErrorObject**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `descriptor` | [`NodeDescriptor`](modules.md#nodedescriptor) | The node that threw the error. |
| `error` | `string` \| `object` | The error message. Can be a string or a more detailed object. For example, fetch errors may return a JSON response from the server. |
| `inputs` | [`InputValues`](modules.md#inputvalues) | The inputs that were passed to the node that threw the error. |

#### Defined in

[packages/breadboard/src/types.ts:605](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L605)

___

### ErrorResponse

Ƭ **ErrorResponse**: `Object`

Sent by the runner when an error occurs.
Error response also indicates that the board is done running.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `error` | `string` \| [`ErrorObject`](modules.md#errorobject) | The error message string or a more detailed error object |
| `timestamp` | `number` | - |

#### Defined in

[packages/breadboard/src/types.ts:624](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L624)

___

### GenericKit

Ƭ **GenericKit**\<`T`\>: [`Kit`](interfaces/Kit.md) & \{ [key in keyof T]: NodeSugar\<unknown, unknown\> }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`NodeHandlers`](modules.md#nodehandlers) |

#### Defined in

[packages/breadboard/src/types.ts:420](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L420)

___

### GraphDescriptor

Ƭ **GraphDescriptor**: [`GraphMetadata`](modules.md#graphmetadata) & \{ `args?`: [`InputValues`](modules.md#inputvalues) ; `edges`: [`Edge`](modules.md#edge)[] ; `graphs?`: [`SubGraphs`](modules.md#subgraphs) ; `kits?`: [`KitReference`](modules.md#kitreference)[] ; `nodes`: [`NodeDescriptor`](modules.md#nodedescriptor)[]  }

Represents a graph.

#### Defined in

[packages/breadboard/src/types.ts:210](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L210)

___

### GraphEndProbeMessage

Ƭ **GraphEndProbeMessage**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `data` | [`GraphProbeData`](modules.md#graphprobedata) |
| `type` | ``"graphend"`` |

#### Defined in

[packages/breadboard/src/types.ts:512](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L512)

___

### GraphIdentifier

Ƭ **GraphIdentifier**: `string`

Unique identifier of a graph.

#### Defined in

[packages/breadboard/src/types.ts:198](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L198)

___

### GraphMetadata

Ƭ **GraphMetadata**: `Object`

Represents graph metadata.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `$schema?` | `string` | The schema of the graph. |
| `description?` | `string` | The description of the graph. |
| `title?` | `string` | The title of the graph. |
| `url?` | `string` | The URL pointing to the location of the graph. This URL is used to resolve relative paths in the graph. If not specified, the paths are assumed to be relative to the current working directory. |
| `version?` | `string` | Version of the graph. [semver](https://semver.org/) format is encouraged. |

#### Defined in

[packages/breadboard/src/types.ts:167](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L167)

___

### GraphProbeData

Ƭ **GraphProbeData**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `metadata` | [`GraphMetadata`](modules.md#graphmetadata) |
| `path` | `number`[] |
| `timestamp` | `number` |

#### Defined in

[packages/breadboard/src/types.ts:501](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L501)

___

### GraphStartProbeMessage

Ƭ **GraphStartProbeMessage**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `data` | [`GraphProbeData`](modules.md#graphprobedata) |
| `type` | ``"graphstart"`` |

#### Defined in

[packages/breadboard/src/types.ts:507](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L507)

___

### InputIdentifier

Ƭ **InputIdentifier**: `string`

Unique identifier of a node's input.

#### Defined in

[packages/breadboard/src/types.ts:68](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L68)

___

### InputResponse

Ƭ **InputResponse**: `Object`

Sent by the runner to request input.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `inputArguments` | [`InputValues`](modules.md#inputvalues) & \{ `schema?`: [`Schema`](modules.md#schema)  } | The input arguments that were given to the node that is requesting input. These arguments typically contain the schema of the inputs that are expected. **`See`** [InputValues] |
| `node` | [`NodeDescriptor`](modules.md#nodedescriptor) | The description of the node that is requesting input. **`See`** [NodeDescriptor] |
| `timestamp` | `number` | - |

#### Defined in

[packages/breadboard/src/types.ts:589](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L589)

___

### InputValues

Ƭ **InputValues**: `Record`\<[`InputIdentifier`](modules.md#inputidentifier), [`NodeValue`](modules.md#nodevalue)\>

Values that are supplied as inputs to the `NodeHandler`.

#### Defined in

[packages/breadboard/src/types.ts:273](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L273)

___

### InputsForGraphDeclaration

Ƭ **InputsForGraphDeclaration**\<`T`\>: \{ [K in keyof T]: V\<T[K]\> & Function } & \{ [key in string]: V\<NodeValue\> }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:81](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L81)

___

### InputsForHandler

Ƭ **InputsForHandler**\<`T`\>: \{ [K in keyof T]: V\<T[K]\> & PromiseLike\<T[K]\> & Function } & \{ [key in string]: V\<NodeValue\> & PromiseLike\<NodeValue\> } & `PromiseLike`\<`T`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:73](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L73)

___

### InputsMaybeAsValues

Ƭ **InputsMaybeAsValues**\<`T`, `NI`\>: `Partial`\<\{ [K in keyof T]: V\<T[K]\> \| \_\_NodeProxy\<NI, OutputValue\<T[K]\>\> \| T[K] }\> & \{ [key in string]: V\<NodeValue\> \| \_\_NodeProxy\<NI, Partial\<NewInputValuesWithNodeFactory\>\> \| NodeValue }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `NI` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:30](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L30)

___

### InvocationId

Ƭ **InvocationId**: `number`

Sequential number of the invocation of a node.
Useful for understanding the relative position of a
given invocation of node within the run.

#### Defined in

[packages/breadboard/src/types.ts:472](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L472)

___

### KitDescriptor

Ƭ **KitDescriptor**: [`KitReference`](modules.md#kitreference) & \{ `description?`: `string` ; `title?`: `string` ; `version?`: `string`  }

#### Defined in

[packages/breadboard/src/types.ts:148](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L148)

___

### KitReference

Ƭ **KitReference**: `Object`

Represents references to a "kit": a collection of `NodeHandlers`.
The basic permise here is that people can publish kits with interesting
handlers, and then graphs can specify which ones they use.
The `@google-labs/core-kit` package is an example of kit.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `url` | `string` | The URL pointing to the location of the kit. |

#### Defined in

[packages/breadboard/src/types.ts:141](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L141)

___

### Lambda

Ƭ **Lambda**\<`I`, `O`\>: [`NewNodeFactory`](modules.md#newnodefactory)\<`I`, `O`\> & [`Serializeable`](interfaces/Serializeable.md) & `ClosureNodeInterface`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `O` | extends `OutputValues` = `OutputValues` |

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:122](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L122)

___

### LambdaFunction

Ƭ **LambdaFunction**\<`In`, `Out`\>: (`board`: [`Breadboard`](interfaces/Breadboard.md), `input`: [`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\>, `output`: [`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\>) => `void`

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
| `board` | [`Breadboard`](interfaces/Breadboard.md) |
| `input` | [`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\> |
| `output` | [`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\> |

##### Returns

`void`

#### Defined in

[packages/breadboard/src/types.ts:757](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L757)

___

### LambdaNodeInputs

Ƭ **LambdaNodeInputs**: [`InputValues`](modules.md#inputvalues) & \{ `args`: [`InputValues`](modules.md#inputvalues) ; `board`: [`BreadboardCapability`](modules.md#breadboardcapability)  }

#### Defined in

[packages/breadboard/src/types.ts:763](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L763)

___

### LambdaNodeOutputs

Ƭ **LambdaNodeOutputs**: [`OutputValues`](modules.md#outputvalues) & \{ `board`: [`BreadboardCapability`](modules.md#breadboardcapability)  }

#### Defined in

[packages/breadboard/src/types.ts:779](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L779)

___

### NewInputValues

Ƭ **NewInputValues**: `Object`

#### Index signature

▪ [key: `string`]: [`NewNodeValue`](modules.md#newnodevalue)

#### Defined in

[packages/breadboard/src/new/runner/types.ts:24](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/runner/types.ts#L24)

___

### NewInputValuesWithNodeFactory

Ƭ **NewInputValuesWithNodeFactory**: `Object`

#### Index signature

▪ [key: `string`]: `NodeValue`

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:27](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L27)

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

[packages/breadboard/src/new/grammar/types.ts:63](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L63)

___

### NewNodeValue

Ƭ **NewNodeValue**: [`NodeValue`](modules.md#nodevalue) \| `PromiseLike`\<[`NewNodeValue`](modules.md#newnodevalue)\> \| `unknown`

#### Defined in

[packages/breadboard/src/new/runner/types.ts:21](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/runner/types.ts#L21)

___

### NewOutputValues

Ƭ **NewOutputValues**: `Object`

#### Index signature

▪ [key: `string`]: [`NewNodeValue`](modules.md#newnodevalue)

#### Defined in

[packages/breadboard/src/new/runner/types.ts:26](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/runner/types.ts#L26)

___

### NodeConfiguration

Ƭ **NodeConfiguration**: `Record`\<`string`, [`NodeValue`](modules.md#nodevalue)\>

Values that are supplied as part of the graph. These values are merged with
the `InputValues` and supplied as inputs to the `NodeHandler`.

#### Defined in

[packages/breadboard/src/types.ts:284](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L284)

___

### NodeConfigurationConstructor

Ƭ **NodeConfigurationConstructor**: `Record`\<`string`, [`NodeValue`](modules.md#nodevalue) \| [`BreadboardNode`](interfaces/BreadboardNode.md)\<[`InputValues`](modules.md#inputvalues), [`OutputValues`](modules.md#outputvalues)\>\>

A node configuration that optionally has nodes as values. The Node()
constructor will remove those and turn them into wires into the node instead.

#### Defined in

[packages/breadboard/src/types.ts:728](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L728)

___

### NodeDescriberFunction

Ƭ **NodeDescriberFunction**: (`inputs?`: [`InputValues`](modules.md#inputvalues), `inputSchema?`: [`Schema`](modules.md#schema), `outputSchema?`: [`Schema`](modules.md#schema)) => `Promise`\<[`NodeDescriberResult`](modules.md#nodedescriberresult)\>

Asks to describe a node. Can be called in multiple ways:
- when called with no arguments, will produce the "default schema". That is,
the inputs/outputs that are always available.
- when called with inputs and schemas, will produce the "expected schema".
For example, when a node changes its schema based on the actual inputs,
it will return different schemas when inputs/schemas are supplied than
when they are not.

#### Type declaration

▸ (`inputs?`, `inputSchema?`, `outputSchema?`): `Promise`\<[`NodeDescriberResult`](modules.md#nodedescriberresult)\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `inputs?` | [`InputValues`](modules.md#inputvalues) |
| `inputSchema?` | [`Schema`](modules.md#schema) |
| `outputSchema?` | [`Schema`](modules.md#schema) |

##### Returns

`Promise`\<[`NodeDescriberResult`](modules.md#nodedescriberresult)\>

#### Defined in

[packages/breadboard/src/types.ts:325](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L325)

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

[packages/breadboard/src/types.ts:311](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L311)

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

[packages/breadboard/src/types.ts:78](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L78)

___

### NodeEndProbeMessage

Ƭ **NodeEndProbeMessage**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `data` | [`NodeEndResponse`](modules.md#nodeendresponse) |
| `type` | ``"nodeend"`` |

#### Defined in

[packages/breadboard/src/types.ts:534](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L534)

___

### NodeEndResponse

Ƭ **NodeEndResponse**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `inputs` | [`InputValues`](modules.md#inputvalues) |
| `node` | [`NodeDescriptor`](modules.md#nodedescriptor) |
| `outputs` | [`OutputValues`](modules.md#outputvalues) |
| `path` | `number`[] |
| `timestamp` | `number` |
| `validatorMetadata?` | [`BreadboardValidatorMetadata`](interfaces/BreadboardValidatorMetadata.md)[] |

#### Defined in

[packages/breadboard/src/types.ts:577](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L577)

___

### NodeHandler

Ƭ **NodeHandler**: \{ `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `invoke`: [`NodeHandlerFunction`](modules.md#nodehandlerfunction)  } \| [`NodeHandlerFunction`](modules.md#nodehandlerfunction)

#### Defined in

[packages/breadboard/src/types.ts:331](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L331)

___

### NodeHandlerFunction

Ƭ **NodeHandlerFunction**: (`inputs`: [`InputValues`](modules.md#inputvalues), `context`: [`NodeHandlerContext`](interfaces/NodeHandlerContext.md)) => `Promise`\<[`OutputValues`](modules.md#outputvalues) \| `void`\>

A function that represents a type of a node in the graph.

#### Type declaration

▸ (`inputs`, `context`): `Promise`\<[`OutputValues`](modules.md#outputvalues) \| `void`\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`InputValues`](modules.md#inputvalues) |
| `context` | [`NodeHandlerContext`](interfaces/NodeHandlerContext.md) |

##### Returns

`Promise`\<[`OutputValues`](modules.md#outputvalues) \| `void`\>

#### Defined in

[packages/breadboard/src/types.ts:289](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L289)

___

### NodeHandlers

Ƭ **NodeHandlers**: [`ReservedNodeNames`](modules.md#reservednodenames) & `Record`\<[`NodeTypeIdentifier`](modules.md#nodetypeidentifier), [`NodeHandler`](modules.md#nodehandler)\>

All known node handlers.

#### Defined in

[packages/breadboard/src/types.ts:341](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L341)

___

### NodeIdentifier

Ƭ **NodeIdentifier**: `string`

Unique identifier of a node in a graph.

#### Defined in

[packages/breadboard/src/types.ts:58](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L58)

___

### NodeStartProbeMessage

Ƭ **NodeStartProbeMessage**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `data` | [`NodeStartResponse`](modules.md#nodestartresponse) |
| `state` | [`RunState`](modules.md#runstate) |
| `type` | ``"nodestart"`` |

#### Defined in

[packages/breadboard/src/types.ts:528](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L528)

___

### NodeStartResponse

Ƭ **NodeStartResponse**: `Object`

Sent by the runner just before a node is about to run.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `inputs` | [`InputValues`](modules.md#inputvalues) | - |
| `node` | [`NodeDescriptor`](modules.md#nodedescriptor) | The description of the node that is about to run. **`See`** [NodeDescriptor] |
| `path` | `number`[] | - |
| `timestamp` | `number` | - |

#### Defined in

[packages/breadboard/src/types.ts:566](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L566)

___

### NodeSugar

Ƭ **NodeSugar**\<`In`, `Out`\>: (`config?`: [`ConfigOrLambda`](modules.md#configorlambda)\<`In`, `Out`\>) => [`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\>

#### Type parameters

| Name |
| :------ |
| `In` |
| `Out` |

#### Type declaration

▸ (`config?`): [`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `config?` | [`ConfigOrLambda`](modules.md#configorlambda)\<`In`, `Out`\> |

##### Returns

[`BreadboardNode`](interfaces/BreadboardNode.md)\<`In`, `Out`\>

#### Defined in

[packages/breadboard/src/types.ts:416](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L416)

___

### NodeTypeIdentifier

Ƭ **NodeTypeIdentifier**: `string`

Unique identifier of a node's type.

#### Defined in

[packages/breadboard/src/types.ts:73](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L73)

___

### NodeValue

Ƭ **NodeValue**: `string` \| `number` \| `boolean` \| ``null`` \| `undefined` \| [`NodeValue`](modules.md#nodevalue)[] \| [`Capability`](interfaces/Capability.md) \| \{ `[key: string]`: [`NodeValue`](modules.md#nodevalue);  }

A type representing a valid JSON value.

#### Defined in

[packages/breadboard/src/types.ts:45](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L45)

___

### NodeValuesQueues

Ƭ **NodeValuesQueues**: `Map`\<`string`, [`NodeValue`](modules.md#nodevalue)[]\>

The Map of queues of all outputs that were sent to a given node,
and a map of these for all nodes.

#### Defined in

[packages/breadboard/src/types.ts:241](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L241)

___

### NodeValuesQueuesMap

Ƭ **NodeValuesQueuesMap**: `Map`\<[`NodeIdentifier`](modules.md#nodeidentifier), [`NodeValuesQueues`](modules.md#nodevaluesqueues)\>

#### Defined in

[packages/breadboard/src/types.ts:242](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L242)

___

### OptionalIdConfiguration

Ƭ **OptionalIdConfiguration**: \{ `$id?`: `string`  } & [`NodeConfigurationConstructor`](modules.md#nodeconfigurationconstructor)

A node configuration that can optionally have an `$id` property.

The `$id` property is used to identify the node in the board and is not
passed to the node itself.

#### Defined in

[packages/breadboard/src/types.ts:720](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L720)

___

### OutputIdentifier

Ƭ **OutputIdentifier**: `string`

Unique identifier of a node's output.

#### Defined in

[packages/breadboard/src/types.ts:63](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L63)

___

### OutputResponse

Ƭ **OutputResponse**: `Object`

Sent by the runner to supply outputs.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `node` | [`NodeDescriptor`](modules.md#nodedescriptor) | The description of the node that is providing output. **`See`** [NodeDescriptor] |
| `outputs` | [`OutputValues`](modules.md#outputvalues) | The output values that the node is providing. **`See`** [OutputValues] |
| `timestamp` | `number` | - |

#### Defined in

[packages/breadboard/src/types.ts:549](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L549)

___

### OutputValues

Ƭ **OutputValues**: `Partial`\<`Record`\<[`OutputIdentifier`](modules.md#outputidentifier), [`NodeValue`](modules.md#nodevalue)\>\>

Values that the `NodeHandler` outputs.

#### Defined in

[packages/breadboard/src/types.ts:278](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L278)

___

### OutputValuesOrUnknown

Ƭ **OutputValuesOrUnknown**: `Object`

#### Index signature

▪ [key: `string`]: `NodeValue` \| `unknown`

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:58](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L58)

___

### OutputsForGraphDeclaration

Ƭ **OutputsForGraphDeclaration**\<`T`, `NI`\>: \{ [K in keyof T]: V\<T[K]\> \| \_\_NodeProxy\<NI, OutputValue\<T[K]\>\> } & \{ [key in string]: V\<NodeValue\> \| \_\_NodeProxy\<NI, Partial\<NewInputValuesWithNodeFactory\>\> } \| `PromiseLike`\<[`OutputsMaybeAsValues`](modules.md#outputsmaybeasvalues)\<`T`\>\> \| `void`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown) |
| `NI` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:88](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L88)

___

### OutputsMaybeAsValues

Ƭ **OutputsMaybeAsValues**\<`T`, `NI`\>: `Partial`\<\{ [K in keyof T]: V\<T[K]\> \| \_\_NodeProxy\<NI, OutputValue\<T[K]\>\> \| T[K] \| unknown }\> & \{ [key in string]: V\<NodeValue\> \| \_\_NodeProxy\<NI, Partial\<NewInputValuesWithNodeFactory\>\> \| NodeValue }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown) |
| `NI` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:42](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L42)

___

### PatchedReadableStream

Ƭ **PatchedReadableStream**\<`T`\>: `ReadableStream`\<`T`\> & `AsyncIterable`\<`T`\>

#### Type parameters

| Name |
| :------ |
| `T` |

#### Defined in

[packages/breadboard/src/stream.ts:108](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/stream.ts#L108)

___

### ProbeMessage

Ƭ **ProbeMessage**: [`GraphStartProbeMessage`](modules.md#graphstartprobemessage) \| [`GraphEndProbeMessage`](modules.md#graphendprobemessage) \| [`SkipProbeMessage`](modules.md#skipprobemessage) \| [`NodeStartProbeMessage`](modules.md#nodestartprobemessage) \| [`NodeEndProbeMessage`](modules.md#nodeendprobemessage)

#### Defined in

[packages/breadboard/src/types.ts:539](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L539)

___

### ReservedNodeNames

Ƭ **ReservedNodeNames**: \{ [key in keyof KitDescriptor]?: never }

Make sure that kit node names can't accidentally stomp over the properties
that describe a kit.

#### Defined in

[packages/breadboard/src/types.ts:304](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L304)

___

### RunResultType

Ƭ **RunResultType**: ``"input"`` \| ``"output"``

#### Defined in

[packages/breadboard/src/types.ts:350](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L350)

___

### RunStackEntry

Ƭ **RunStackEntry**: `Object`

Information about a given invocation of a graph and
node within the graph.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `graph` | [`InvocationId`](modules.md#invocationid) | The invocation id of the graph. |
| `node` | [`InvocationId`](modules.md#invocationid) | The invocation id of the node within that graph. |
| `state?` | `string` | The state of the graph traversal at the time of the invocation. |

#### Defined in

[packages/breadboard/src/types.ts:478](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L478)

___

### RunState

Ƭ **RunState**: [`RunStackEntry`](modules.md#runstackentry)[]

A stack of all invocations of graphs and nodes within the graphs.
The stack is ordered from the outermost graph to the innermost graph
that is currently being run.
Can be used to understand the current state of the run.

#### Defined in

[packages/breadboard/src/types.ts:499](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L499)

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
| `transient?` | `boolean` | - |
| `type?` | `string` \| `string`[] | - |

#### Defined in

[packages/breadboard/src/types.ts:7](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L7)

___

### SkipProbeMessage

Ƭ **SkipProbeMessage**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `data` | \{ `inputs`: [`InputValues`](modules.md#inputvalues) ; `missingInputs`: `string`[] ; `node`: [`NodeDescriptor`](modules.md#nodedescriptor) ; `path`: `number`[] ; `timestamp`: `number`  } |
| `data.inputs` | [`InputValues`](modules.md#inputvalues) |
| `data.missingInputs` | `string`[] |
| `data.node` | [`NodeDescriptor`](modules.md#nodedescriptor) |
| `data.path` | `number`[] |
| `data.timestamp` | `number` |
| `type` | ``"skip"`` |

#### Defined in

[packages/breadboard/src/types.ts:517](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L517)

___

### SubGraphs

Ƭ **SubGraphs**: `Record`\<[`GraphIdentifier`](modules.md#graphidentifier), [`GraphDescriptor`](modules.md#graphdescriptor)\>

Represents a collection of sub-graphs.
The key is the identifier of the sub-graph.
The value is the descriptor of the sub-graph.

#### Defined in

[packages/breadboard/src/types.ts:205](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L205)

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

[packages/breadboard/src/new/grammar/types.ts:291](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L291)

___

### \_\_ProjectBackToOutputValues

Ƭ **\_\_ProjectBackToOutputValues**\<`O`\>: \{ [K in keyof O]: O[K] extends NodeValue ? O[K] : NodeValue }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `O` | extends [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown) |

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:59](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/types.ts#L59)

## Variables

### base

• `Const` **base**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `input` | \<T\>(`config`: \{ `$id?`: `string` ; `schema`: `T`  } & `Partial`\<\{ [K in string \| number \| symbol]: T[K] \| V\<T[K]\> \| \_\_NodeProxy\<NewInputValuesWithNodeFactory, Partial\<Object\>\> }\> & {}) => [`__NodeProxy`](modules.md#__nodeproxy)\<`Record`\<`string`, `never`\>, `T`\> & (`config?`: \{ `$id?`: `string` ; `schema?`: [`Schema`](modules.md#schema)  } & `Partial`\<{}\> & {}) => [`__NodeProxy`](modules.md#__nodeproxy)\<[`NewInputValues`](modules.md#newinputvalues), [`NewOutputValues`](modules.md#newoutputvalues)\> |
| `output` | \<T\>(`config`: \{ `$id?`: `string` ; `schema`: `T`  } & `Partial`\<\{ [K in string \| number \| symbol]: T[K] \| V\<T[K]\> \| \_\_NodeProxy\<NewInputValuesWithNodeFactory, Partial\<Object\>\> }\> & {}) => [`__NodeProxy`](modules.md#__nodeproxy)\<`T`, `Record`\<`string`, `never`\>\> & (`config?`: \{ `$id?`: `string` ; `schema?`: [`Schema`](modules.md#schema)  } & `Partial`\<{}\> & {}) => [`__NodeProxy`](modules.md#__nodeproxy)\<[`NewInputValues`](modules.md#newinputvalues), `Record`\<`string`, `never`\>\> |

#### Defined in

[packages/breadboard/src/new/grammar/base.ts:29](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/base.ts#L29)

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

[packages/breadboard/src/new/grammar/kits.ts:38](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/kits.ts#L38)

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

[packages/breadboard/src/kits/ctors.ts:29](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/kits/ctors.ts#L29)

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
| `[asyncIterator]` | () => `AsyncGenIterator`\<`T`\> |

#### Defined in

[packages/breadboard/src/utils/async-gen.ts:196](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/utils/async-gen.ts#L196)

___

### board

▸ **board**\<`I`, `O`\>(`fn`): [`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

Implementation of the overloaded board function.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `O` | extends `OutputValues` = `OutputValues` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `fn` | `GraphDeclarationFunction`\<`I`, `O`\> |

#### Returns

[`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

#### Defined in

[packages/breadboard/src/new/grammar/board.ts:37](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/board.ts#L37)

▸ **board**\<`I`, `O`\>(`opts`): [`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

Implementation of the overloaded board function.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `O` | extends `OutputValues` = `OutputValues` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | \{ `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `graph?`: `GraphDeclarationFunction`\<[`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory), [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown)\> ; `input?`: [`Schema`](modules.md#schema) ; `invoke?`: `NodeProxyHandlerFunction`\<[`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory), [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown)\> ; `name?`: `string` ; `output?`: [`Schema`](modules.md#schema)  } & [`GraphMetadata`](modules.md#graphmetadata) |

#### Returns

[`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

#### Defined in

[packages/breadboard/src/new/grammar/board.ts:37](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/board.ts#L37)

▸ **board**\<`I`, `O`\>(`opts`, `fn`): [`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

Implementation of the overloaded board function.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory) |
| `O` | extends `OutputValues` = `OutputValues` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | \{ `describe?`: [`NodeDescriberFunction`](modules.md#nodedescriberfunction) ; `graph?`: `GraphDeclarationFunction`\<[`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory), [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown)\> ; `input?`: [`Schema`](modules.md#schema) ; `invoke?`: `NodeProxyHandlerFunction`\<[`NewInputValuesWithNodeFactory`](modules.md#newinputvalueswithnodefactory), [`OutputValuesOrUnknown`](modules.md#outputvaluesorunknown)\> ; `name?`: `string` ; `output?`: [`Schema`](modules.md#schema)  } & [`GraphMetadata`](modules.md#graphmetadata) |
| `fn` | `GraphDeclarationFunction`\<`I`, `O`\> |

#### Returns

[`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

#### Defined in

[packages/breadboard/src/new/grammar/board.ts:37](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/board.ts#L37)

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

[packages/breadboard/src/handler.ts:23](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/handler.ts#L23)

___

### clone

▸ **clone**(`streamCapability`): `ReadableStream`\<`object`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `streamCapability` | [`StreamCapabilityType`](interfaces/StreamCapabilityType.md)\<`object`\> |

#### Returns

`ReadableStream`\<`object`\>

#### Defined in

[packages/breadboard/src/stream.ts:27](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/stream.ts#L27)

___

### code

▸ **code**\<`I`, `O`\>(`fn`): [`Lambda`](modules.md#lambda)\<`I`, `Required`\<`O`\>\>

Explicit implementations of the overloaded variants, also splitting
graph generation and code boards.

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

[packages/breadboard/src/new/grammar/board.ts:60](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/new/grammar/board.ts#L60)

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

[packages/breadboard/src/stream.ts:33](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/stream.ts#L33)

___

### patchReadableStream

▸ **patchReadableStream**(): `void`

#### Returns

`void`

#### Defined in

[packages/breadboard/src/stream.ts:287](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/stream.ts#L287)

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

[packages/breadboard/src/stream.ts:310](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/stream.ts#L310)

___

### toMermaid

▸ **toMermaid**(`graph`, `direction?`, `unstyled?`, `ignoreSubgraphs?`): `string`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `graph` | [`GraphDescriptor`](modules.md#graphdescriptor) | `undefined` |
| `direction` | `string` | `"TD"` |
| `unstyled` | `boolean` | `false` |
| `ignoreSubgraphs` | `boolean` | `false` |

#### Returns

`string`

#### Defined in

[packages/breadboard/src/mermaid.ts:196](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/mermaid.ts#L196)

___

### traversalResultFromStack

▸ **traversalResultFromStack**(`stack`): `undefined` \| [`MachineResult`](classes/MachineResult.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `stack` | [`RunState`](modules.md#runstate) |

#### Returns

`undefined` \| [`MachineResult`](classes/MachineResult.md)

#### Defined in

[packages/breadboard/src/stack.ts:52](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/stack.ts#L52)
