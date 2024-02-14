[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / RunResult

# Class: RunResult

## Implements

- [`BreadboardRunResult`](../interfaces/BreadboardRunResult.md)

## Table of contents

### Constructors

- [constructor](RunResult.md#constructor)

### Properties

- [#invocationId](RunResult.md##invocationid)
- [#runState](RunResult.md##runstate)
- [#state](RunResult.md##state)
- [#type](RunResult.md##type)

### Accessors

- [inputArguments](RunResult.md#inputarguments)
- [inputs](RunResult.md#inputs)
- [invocationId](RunResult.md#invocationid)
- [node](RunResult.md#node)
- [outputs](RunResult.md#outputs)
- [runState](RunResult.md#runstate)
- [state](RunResult.md#state)
- [timestamp](RunResult.md#timestamp)
- [type](RunResult.md#type)

### Methods

- [isAtExitNode](RunResult.md#isatexitnode)
- [save](RunResult.md#save)
- [load](RunResult.md#load)

## Constructors

### constructor

• **new RunResult**(`state`, `type`, `runState`, `invocationId`): [`RunResult`](RunResult.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `state` | [`TraversalResult`](../interfaces/TraversalResult.md) |
| `type` | [`RunResultType`](../modules.md#runresulttype) |
| `runState` | `undefined` \| [`RunState`](../modules.md#runstate) |
| `invocationId` | `number` |

#### Returns

[`RunResult`](RunResult.md)

#### Defined in

[packages/breadboard/src/run.ts:27](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L27)

## Properties

### #invocationId

• `Private` **#invocationId**: `number`

#### Defined in

[packages/breadboard/src/run.ts:25](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L25)

___

### #runState

• `Private` **#runState**: `undefined` \| [`RunState`](../modules.md#runstate)

#### Defined in

[packages/breadboard/src/run.ts:23](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L23)

___

### #state

• `Private` **#state**: [`TraversalResult`](../interfaces/TraversalResult.md)

#### Defined in

[packages/breadboard/src/run.ts:21](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L21)

___

### #type

• `Private` **#type**: [`RunResultType`](../modules.md#runresulttype)

#### Defined in

[packages/breadboard/src/run.ts:20](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L20)

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

[packages/breadboard/src/run.ts:51](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L51)

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

[packages/breadboard/src/run.ts:55](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L55)

___

### invocationId

• `get` **invocationId**(): `number`

The invocation id of the current node. This is useful for tracking
the node within the run, similar to an "index" property in map/forEach.

#### Returns

`number`

#### Implementation of

BreadboardRunResult.invocationId

#### Defined in

[packages/breadboard/src/run.ts:39](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L39)

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

[packages/breadboard/src/run.ts:47](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L47)

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

[packages/breadboard/src/run.ts:59](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L59)

___

### runState

• `get` **runState**(): `undefined` \| [`RunState`](../modules.md#runstate)

#### Returns

`undefined` \| [`RunState`](../modules.md#runstate)

#### Defined in

[packages/breadboard/src/run.ts:71](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L71)

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

[packages/breadboard/src/run.ts:63](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L63)

___

### timestamp

• `get` **timestamp**(): `number`

The timestamp of when this result was issued.

#### Returns

`number`

#### Implementation of

BreadboardRunResult.timestamp

#### Defined in

[packages/breadboard/src/run.ts:75](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L75)

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

[packages/breadboard/src/run.ts:43](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L43)

## Methods

### isAtExitNode

▸ **isAtExitNode**(): `boolean`

#### Returns

`boolean`

#### Defined in

[packages/breadboard/src/run.ts:79](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L79)

___

### save

▸ **save**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

#### Defined in

[packages/breadboard/src/run.ts:67](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L67)

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

[packages/breadboard/src/run.ts:87](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/run.ts#L87)
