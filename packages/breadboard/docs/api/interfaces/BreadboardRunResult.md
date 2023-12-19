[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / BreadboardRunResult

# Interface: BreadboardRunResult

## Implemented by

- [`RunResult`](../classes/RunResult.md)

## Table of contents

### Properties

- [node](BreadboardRunResult.md#node)
- [type](BreadboardRunResult.md#type)

### Accessors

- [inputArguments](BreadboardRunResult.md#inputarguments)
- [inputs](BreadboardRunResult.md#inputs)
- [outputs](BreadboardRunResult.md#outputs)
- [state](BreadboardRunResult.md#state)

## Properties

### node

• **node**: [`NodeDescriptor`](../modules.md#nodedescriptor)

The current node that is being visited. This property can be used to get
information about the current node, such as its id, type, and
configuration.

#### Defined in

[packages/breadboard/src/types.ts:357](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L357)

___

### type

• **type**: [`RunResultType`](../modules.md#runresulttype)

Type of the run result. This property indicates where the board
currently is in the `run` process.

#### Defined in

[packages/breadboard/src/types.ts:351](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L351)

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

#### Defined in

[packages/breadboard/src/types.ts:365](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L365)

___

### inputs

• `set` **inputs**(`input`): `void`

The input values the board is waiting for.
Set this property to provide input values.
This property is only available when `ResultRunType` is `input`.

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | [`InputValues`](../modules.md#inputvalues) |

#### Returns

`void`

#### Defined in

[packages/breadboard/src/types.ts:371](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L371)

___

### outputs

• `get` **outputs**(): `Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>

the output values the board is providing.
This property is only available when `ResultRunType` is `output`.

#### Returns

`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>

#### Defined in

[packages/breadboard/src/types.ts:376](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L376)

___

### state

• `get` **state**(): [`TraversalResult`](TraversalResult.md)

Current state of the underlying graph traversal.
This property is useful for saving and restoring the state of
graph traversal.

#### Returns

[`TraversalResult`](TraversalResult.md)

#### Defined in

[packages/breadboard/src/types.ts:382](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L382)
