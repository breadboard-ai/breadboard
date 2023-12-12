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

| Name    | Type                                                  |
| :------ | :---------------------------------------------------- |
| `state` | [`TraversalResult`](../interfaces/TraversalResult.md) |
| `type`  | [`RunResultType`](../modules.md#runresulttype)        |

#### Defined in

[seeds/breadboard/src/run.ts:44](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L44)

## Properties

### #state

• `Private` **#state**: [`TraversalResult`](../interfaces/TraversalResult.md)

#### Defined in

[seeds/breadboard/src/run.ts:42](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L42)

---

### #type

• `Private` **#type**: [`RunResultType`](../modules.md#runresulttype)

#### Defined in

[seeds/breadboard/src/run.ts:41](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L41)

## Accessors

### inputArguments

• `get` **inputArguments**(): [`InputValues`](../modules.md#inputvalues)

#### Returns

[`InputValues`](../modules.md#inputvalues)

#### Implementation of

BreadboardRunResult.inputArguments

#### Defined in

[seeds/breadboard/src/run.ts:57](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L57)

---

### inputs

• `set` **inputs**(`inputs`): `void`

#### Parameters

| Name     | Type                                       |
| :------- | :----------------------------------------- |
| `inputs` | [`InputValues`](../modules.md#inputvalues) |

#### Returns

`void`

#### Implementation of

BreadboardRunResult.inputs

#### Defined in

[seeds/breadboard/src/run.ts:61](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L61)

---

### node

• `get` **node**(): [`NodeDescriptor`](../modules.md#nodedescriptor)

#### Returns

[`NodeDescriptor`](../modules.md#nodedescriptor)

#### Implementation of

BreadboardRunResult.node

#### Defined in

[seeds/breadboard/src/run.ts:53](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L53)

---

### outputs

• `get` **outputs**(): `Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>

#### Returns

`Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>

#### Implementation of

BreadboardRunResult.outputs

#### Defined in

[seeds/breadboard/src/run.ts:65](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L65)

---

### state

• `get` **state**(): [`TraversalResult`](../interfaces/TraversalResult.md)

#### Returns

[`TraversalResult`](../interfaces/TraversalResult.md)

#### Implementation of

BreadboardRunResult.state

#### Defined in

[seeds/breadboard/src/run.ts:69](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L69)

---

### type

• `get` **type**(): [`RunResultType`](../modules.md#runresulttype)

#### Returns

[`RunResultType`](../modules.md#runresulttype)

#### Implementation of

BreadboardRunResult.type

#### Defined in

[seeds/breadboard/src/run.ts:49](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L49)

## Methods

### isAtExitNode

▸ **isAtExitNode**(): `boolean`

#### Returns

`boolean`

#### Defined in

[seeds/breadboard/src/run.ts:83](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L83)

---

### save

▸ **save**(): `Promise`<`string`\>

#### Returns

`Promise`<`string`\>

#### Defined in

[seeds/breadboard/src/run.ts:73](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L73)

---

### load

▸ `Static` **load**(`stringifiedResult`): [`RunResult`](RunResult.md)

#### Parameters

| Name                | Type     |
| :------------------ | :------- |
| `stringifiedResult` | `string` |

#### Returns

[`RunResult`](RunResult.md)

#### Defined in

[seeds/breadboard/src/run.ts:91](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/run.ts#L91)
