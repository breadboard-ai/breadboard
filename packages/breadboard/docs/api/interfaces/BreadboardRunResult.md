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
- [invocationId](BreadboardRunResult.md#invocationid)
- [outputs](BreadboardRunResult.md#outputs)
- [state](BreadboardRunResult.md#state)
- [timestamp](BreadboardRunResult.md#timestamp)

## Properties

### node

• **node**: [`NodeDescriptor`](../modules.md#nodedescriptor)

The current node that is being visited. This property can be used to get
information about the current node, such as its id, type, and
configuration.

#### Defined in

[packages/breadboard/src/types.ts:363](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L363)

___

### type

• **type**: [`RunResultType`](../modules.md#runresulttype)

Type of the run result. This property indicates where the board
currently is in the `run` process.

#### Defined in

[packages/breadboard/src/types.ts:357](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L357)

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

[packages/breadboard/src/types.ts:371](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L371)

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

[packages/breadboard/src/types.ts:377](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L377)

___

### invocationId

• `get` **invocationId**(): `number`

The invocation id of the current node. This is useful for tracking
the node within the run, similar to an "index" property in map/forEach.

#### Returns

`number`

#### Defined in

[packages/breadboard/src/types.ts:393](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L393)

___

### outputs

• `get` **outputs**(): `Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>

the output values the board is providing.
This property is only available when `ResultRunType` is `output`.

#### Returns

`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>

#### Defined in

[packages/breadboard/src/types.ts:382](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L382)

___

### state

• `get` **state**(): [`TraversalResult`](TraversalResult.md)

Current state of the underlying graph traversal.
This property is useful for saving and restoring the state of
graph traversal.

#### Returns

[`TraversalResult`](TraversalResult.md)

#### Defined in

[packages/breadboard/src/types.ts:388](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L388)

___

### timestamp

• `get` **timestamp**(): `number`

The timestamp of when this result was issued.

#### Returns

`number`

#### Defined in

[packages/breadboard/src/types.ts:397](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L397)
