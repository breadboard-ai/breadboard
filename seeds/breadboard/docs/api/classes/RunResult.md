[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / RunResult

# Class: RunResult

## Implements

- `BreadboardRunResult`

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

• **new RunResult**(`state`, `type`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `state` | `TraversalResult` |
| `type` | [`RunResultType`](../modules.md#runresulttype) |

#### Defined in

[seeds/breadboard/src/run.ts:43](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L43)

## Properties

### #state

• `Private` **#state**: `TraversalResult`

#### Defined in

[seeds/breadboard/src/run.ts:41](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L41)

___

### #type

• `Private` **#type**: [`RunResultType`](../modules.md#runresulttype)

#### Defined in

[seeds/breadboard/src/run.ts:40](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L40)

## Accessors

### inputArguments

• `get` **inputArguments**(): `InputValues`

#### Returns

`InputValues`

#### Implementation of

BreadboardRunResult.inputArguments

#### Defined in

[seeds/breadboard/src/run.ts:56](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L56)

___

### inputs

• `set` **inputs**(`inputs`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | `InputValues` |

#### Returns

`void`

#### Implementation of

BreadboardRunResult.inputs

#### Defined in

[seeds/breadboard/src/run.ts:60](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L60)

___

### node

• `get` **node**(): `NodeDescriptor`

#### Returns

`NodeDescriptor`

#### Implementation of

BreadboardRunResult.node

#### Defined in

[seeds/breadboard/src/run.ts:52](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L52)

___

### outputs

• `get` **outputs**(): `Partial`<`Record`<`string`, `NodeValue`\>\>

#### Returns

`Partial`<`Record`<`string`, `NodeValue`\>\>

#### Implementation of

BreadboardRunResult.outputs

#### Defined in

[seeds/breadboard/src/run.ts:64](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L64)

___

### state

• `get` **state**(): `TraversalResult`

#### Returns

`TraversalResult`

#### Implementation of

BreadboardRunResult.state

#### Defined in

[seeds/breadboard/src/run.ts:68](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L68)

___

### type

• `get` **type**(): [`RunResultType`](../modules.md#runresulttype)

#### Returns

[`RunResultType`](../modules.md#runresulttype)

#### Implementation of

BreadboardRunResult.type

#### Defined in

[seeds/breadboard/src/run.ts:48](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L48)

## Methods

### isAtExitNode

▸ **isAtExitNode**(): `boolean`

#### Returns

`boolean`

#### Defined in

[seeds/breadboard/src/run.ts:82](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L82)

___

### save

▸ **save**(): `Promise`<`string`\>

#### Returns

`Promise`<`string`\>

#### Defined in

[seeds/breadboard/src/run.ts:72](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L72)

___

### load

▸ `Static` **load**(`stringifiedResult`): [`RunResult`](RunResult.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `stringifiedResult` | `string` |

#### Returns

[`RunResult`](RunResult.md)

#### Defined in

[seeds/breadboard/src/run.ts:90](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/run.ts#L90)
