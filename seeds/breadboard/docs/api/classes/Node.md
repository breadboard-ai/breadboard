[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / Node

# Class: Node<Inputs, Outputs\>

## Type parameters

| Name |
| :------ |
| `Inputs` |
| `Outputs` |

## Implements

- [`BreadboardNode`](../interfaces/BreadboardNode.md)<`Inputs`, `Outputs`\>

## Table of contents

### Constructors

- [constructor](Node.md#constructor)

### Properties

- [#breadboard](Node.md##breadboard)
- [#descriptor](Node.md##descriptor)

### Methods

- [wire](Node.md#wire)

## Constructors

### constructor

• **new Node**<`Inputs`, `Outputs`\>(`breadboard`, `type`, `configuration?`, `id?`)

#### Type parameters

| Name |
| :------ |
| `Inputs` |
| `Outputs` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `breadboard` | `Breadboard` |
| `type` | `string` |
| `configuration?` | `NodeConfiguration` |
| `id?` | `string` |

#### Defined in

[seeds/breadboard/src/node.ts:96](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/node.ts#L96)

## Properties

### #breadboard

• `Private` **#breadboard**: `Breadboard`

#### Defined in

[seeds/breadboard/src/node.ts:94](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/node.ts#L94)

___

### #descriptor

• `Private` **#descriptor**: `NodeDescriptor`

#### Defined in

[seeds/breadboard/src/node.ts:93](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/node.ts#L93)

## Methods

### wire

▸ **wire**<`ToInputs`, `ToOutputs`\>(`spec`, `to`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`Inputs`, `Outputs`\>

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
| `to` | [`BreadboardNode`](../interfaces/BreadboardNode.md)<`ToInputs`, `ToOutputs`\> | the node to wire this node with. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`Inputs`, `Outputs`\>

- the current node, to enable chaining.

#### Implementation of

[BreadboardNode](../interfaces/BreadboardNode.md).[wire](../interfaces/BreadboardNode.md#wire)

#### Defined in

[seeds/breadboard/src/node.ts:114](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/node.ts#L114)
