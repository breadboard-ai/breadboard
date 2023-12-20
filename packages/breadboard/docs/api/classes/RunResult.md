[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / RunResult

# Class: RunResult

## Implements

- [`BreadboardRunResult`](../interfaces/BreadboardRunResult.md)

## Table of contents

### Constructors

- [constructor](RunResult.md#constructor)

### Properties

- [#state](RunResult.md##state)
- [#type](RunResult.md##type)

### Accessors

- [inputArguments](RunResult.md#inputarguments)
- [inputs](RunResult.md#inputs)
- [node](RunResult.md#node)
- [outputs](RunResult.md#outputs)
- [state](RunResult.md#state)
- [type](RunResult.md#type)

### Methods

- [isAtExitNode](RunResult.md#isatexitnode)
- [save](RunResult.md#save)
- [load](RunResult.md#load)

## Constructors

### constructor

• **new RunResult**(`state`, `type`): [`RunResult`](RunResult.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `state` | [`TraversalResult`](../interfaces/TraversalResult.md) |
| `type` | [`RunResultType`](../modules.md#runresulttype) |

#### Returns

[`RunResult`](RunResult.md)

#### Defined in

[packages/breadboard/src/run.ts:44](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L44)

## Properties

### #state

• `Private` **#state**: [`TraversalResult`](../interfaces/TraversalResult.md)

#### Defined in

[packages/breadboard/src/run.ts:42](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L42)

___

### #type

• `Private` **#type**: [`RunResultType`](../modules.md#runresulttype)

#### Defined in

[packages/breadboard/src/run.ts:41](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L41)

## Accessors

### inputArguments

• `get` **inputArguments**(): [`InputValues`](../modules.md#inputvalues)

Any arguments that were passed to the `input` node that triggered this
stage.
Usually contains `message` property, which is a friendly message
to the user about what input is expected.
This property is only available when `ResultRunType` is `input`.

#### Returns

[`InputValues`](../modules.md#inputvalues)

#### Implementation of

BreadboardRunResult.inputArguments

#### Defined in

[packages/breadboard/src/run.ts:57](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L57)

___

### inputs

• `set` **inputs**(`inputs`): `void`

The input values the board is waiting for.
Set this property to provide input values.
This property is only available when `ResultRunType` is `input`.

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`InputValues`](../modules.md#inputvalues) |

#### Returns

`void`

#### Implementation of

BreadboardRunResult.inputs

#### Defined in

[packages/breadboard/src/run.ts:61](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L61)

___

### node

• `get` **node**(): [`NodeDescriptor`](../modules.md#nodedescriptor)

The current node that is being visited. This property can be used to get
information about the current node, such as its id, type, and
configuration.

#### Returns

[`NodeDescriptor`](../modules.md#nodedescriptor)

#### Implementation of

[BreadboardRunResult](../interfaces/BreadboardRunResult.md).[node](../interfaces/BreadboardRunResult.md#node)

#### Defined in

[packages/breadboard/src/run.ts:53](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L53)

___

### outputs

• `get` **outputs**(): `Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>

the output values the board is providing.
This property is only available when `ResultRunType` is `output`.

#### Returns

`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>

#### Implementation of

BreadboardRunResult.outputs

#### Defined in

[packages/breadboard/src/run.ts:65](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L65)

___

### state

• `get` **state**(): [`TraversalResult`](../interfaces/TraversalResult.md)

Current state of the underlying graph traversal.
This property is useful for saving and restoring the state of
graph traversal.

#### Returns

[`TraversalResult`](../interfaces/TraversalResult.md)

#### Implementation of

BreadboardRunResult.state

#### Defined in

[packages/breadboard/src/run.ts:69](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L69)

___

### type

• `get` **type**(): [`RunResultType`](../modules.md#runresulttype)

Type of the run result. This property indicates where the board
currently is in the `run` process.

#### Returns

[`RunResultType`](../modules.md#runresulttype)

#### Implementation of

[BreadboardRunResult](../interfaces/BreadboardRunResult.md).[type](../interfaces/BreadboardRunResult.md#type)

#### Defined in

[packages/breadboard/src/run.ts:49](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L49)

## Methods

### isAtExitNode

▸ **isAtExitNode**(): `boolean`

#### Returns

`boolean`

#### Defined in

[packages/breadboard/src/run.ts:83](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L83)

___

### save

▸ **save**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

#### Defined in

[packages/breadboard/src/run.ts:73](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L73)

___

### load

▸ **load**(`stringifiedResult`): [`RunResult`](RunResult.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `stringifiedResult` | `string` |

#### Returns

[`RunResult`](RunResult.md)

#### Defined in

[packages/breadboard/src/run.ts:91](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/run.ts#L91)
