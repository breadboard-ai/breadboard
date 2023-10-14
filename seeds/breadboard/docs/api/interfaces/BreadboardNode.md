[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / BreadboardNode

# Interface: BreadboardNode<Inputs, Outputs\>

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

[seeds/breadboard/src/types.ts:583](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L583)

## Methods

### wire

▸ **wire**<`ToInputs`, `ToOutputs`\>(`spec`, `to`): [`BreadboardNode`](BreadboardNode.md)<`Inputs`, `Outputs`\>

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
| `spec` | `string` | the wiring spec. See the [wiring spec](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/wires.md) for more details. |
| `to` | [`BreadboardNode`](BreadboardNode.md)<`ToInputs`, `ToOutputs`\> | the node to wire this node with. |

#### Returns

[`BreadboardNode`](BreadboardNode.md)<`Inputs`, `Outputs`\>

- the current node, to enable chaining.

#### Defined in

[seeds/breadboard/src/types.ts:577](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/types.ts#L577)
