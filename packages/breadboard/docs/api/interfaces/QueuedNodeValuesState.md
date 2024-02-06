[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / QueuedNodeValuesState

# Interface: QueuedNodeValuesState

## Table of contents

### Properties

- [constants](QueuedNodeValuesState.md#constants)
- [state](QueuedNodeValuesState.md#state)

### Methods

- [getAvailableInputs](QueuedNodeValuesState.md#getavailableinputs)
- [useInputs](QueuedNodeValuesState.md#useinputs)
- [wireOutputs](QueuedNodeValuesState.md#wireoutputs)

## Properties

### constants

• **constants**: [`NodeValuesQueuesMap`](../modules.md#nodevaluesqueuesmap)

#### Defined in

[packages/breadboard/src/types.ts:246](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L246)

___

### state

• **state**: [`NodeValuesQueuesMap`](../modules.md#nodevaluesqueuesmap)

#### Defined in

[packages/breadboard/src/types.ts:245](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L245)

## Methods

### getAvailableInputs

▸ **getAvailableInputs**(`nodeId`): [`InputValues`](../modules.md#inputvalues)

#### Parameters

| Name | Type |
| :------ | :------ |
| `nodeId` | `string` |

#### Returns

[`InputValues`](../modules.md#inputvalues)

#### Defined in

[packages/breadboard/src/types.ts:248](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L248)

___

### useInputs

▸ **useInputs**(`node`, `inputs`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | `string` |
| `inputs` | [`InputValues`](../modules.md#inputvalues) |

#### Returns

`void`

#### Defined in

[packages/breadboard/src/types.ts:249](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L249)

___

### wireOutputs

▸ **wireOutputs**(`opportunites`, `outputs`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `opportunites` | [`Edge`](../modules.md#edge)[] |
| `outputs` | `Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Returns

`void`

#### Defined in

[packages/breadboard/src/types.ts:247](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L247)
