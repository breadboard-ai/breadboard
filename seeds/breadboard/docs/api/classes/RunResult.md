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

[seeds/breadboard/src/run.ts:42](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L42)

## Properties

### #state

• `Private` **#state**: `TraversalResult`

#### Defined in

[seeds/breadboard/src/run.ts:40](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L40)

___

### #type

• `Private` **#type**: [`RunResultType`](../modules.md#runresulttype)

#### Defined in

[seeds/breadboard/src/run.ts:39](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L39)

## Accessors

### inputArguments

• `get` **inputArguments**(): `InputValues`

#### Returns

`InputValues`

#### Implementation of

BreadboardRunResult.inputArguments

#### Defined in

[seeds/breadboard/src/run.ts:55](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L55)

___

### inputs

• `get` **inputs**(): `InputValues`

#### Returns

`InputValues`

#### Implementation of

BreadboardRunResult.inputs

#### Defined in

[seeds/breadboard/src/run.ts:63](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L63)

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

[seeds/breadboard/src/run.ts:59](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L59)

___

### node

• `get` **node**(): `NodeDescriptor`

#### Returns

`NodeDescriptor`

#### Implementation of

BreadboardRunResult.node

#### Defined in

[seeds/breadboard/src/run.ts:51](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L51)

___

### outputs

• `get` **outputs**(): `Partial`<`Record`<`string`, `NodeValue`\>\>

#### Returns

`Partial`<`Record`<`string`, `NodeValue`\>\>

#### Implementation of

BreadboardRunResult.outputs

#### Defined in

[seeds/breadboard/src/run.ts:67](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L67)

___

### state

• `get` **state**(): `TraversalResult`

#### Returns

`TraversalResult`

#### Implementation of

BreadboardRunResult.state

#### Defined in

[seeds/breadboard/src/run.ts:71](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L71)

___

### type

• `get` **type**(): [`RunResultType`](../modules.md#runresulttype)

#### Returns

[`RunResultType`](../modules.md#runresulttype)

#### Implementation of

BreadboardRunResult.type

#### Defined in

[seeds/breadboard/src/run.ts:47](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L47)

## Methods

### isAtExitNode

▸ **isAtExitNode**(): `boolean`

#### Returns

`boolean`

#### Defined in

[seeds/breadboard/src/run.ts:79](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L79)

___

### save

▸ **save**(): `string`

#### Returns

`string`

#### Defined in

[seeds/breadboard/src/run.ts:75](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L75)

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

[seeds/breadboard/src/run.ts:86](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/run.ts#L86)
