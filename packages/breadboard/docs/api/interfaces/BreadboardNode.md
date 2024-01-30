[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / BreadboardNode

# Interface: BreadboardNode\<Inputs, Outputs\>

## Type parameters

| Name |
| :------ |
| `Inputs` |
| `Outputs` |

## Implemented by

- [`Node`](../classes/Node.md)

## Table of contents

### Properties

- [id](BreadboardNode.md#id)

### Methods

- [wire](BreadboardNode.md#wire)

## Properties

### id

• `Readonly` **id**: `string`

#### Defined in

[packages/breadboard/src/types.ts:705](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L705)

## Methods

### wire

▸ **wire**\<`ToInputs`, `ToOutputs`\>(`spec`, `to`): [`BreadboardNode`](BreadboardNode.md)\<`Inputs`, `Outputs`\>

Wires the current node to another node.

Use this method to wire nodes together.

#### Type parameters

| Name |
| :------ |
| `ToInputs` |
| `ToOutputs` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `spec` | `string` | the wiring spec. See the [wiring spec](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/wires.md) for more details. |
| `to` | [`BreadboardNode`](BreadboardNode.md)\<`ToInputs`, `ToOutputs`\> | the node to wire this node with. |

#### Returns

[`BreadboardNode`](BreadboardNode.md)\<`Inputs`, `Outputs`\>

- the current node, to enable chaining.

#### Defined in

[packages/breadboard/src/types.ts:699](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L699)
