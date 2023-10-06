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

### Accessors

- [id](Node.md#id)

### Methods

- [wire](Node.md#wire)

## Constructors

### constructor

• **new Node**<`Inputs`, `Outputs`\>(`breadboard`, `kit`, `type`, `configuration?`, `id?`)

#### Type parameters

| Name |
| :------ |
| `Inputs` |
| `Outputs` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `breadboard` | `Breadboard` |
| `kit` | `undefined` \| [`Kit`](../interfaces/Kit.md) |
| `type` | `string` |
| `configuration?` | [`NodeConfigurationConstructor`](../modules.md#nodeconfigurationconstructor) |
| `id?` | `string` |

#### Defined in

[seeds/breadboard/src/node.ts:103](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/node.ts#L103)

## Properties

### #breadboard

• `Private` **#breadboard**: `Breadboard`

#### Defined in

[seeds/breadboard/src/node.ts:101](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/node.ts#L101)

___

### #descriptor

• `Private` **#descriptor**: `NodeDescriptor`

#### Defined in

[seeds/breadboard/src/node.ts:100](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/node.ts#L100)

## Accessors

### id

• `get` **id**(): `string`

#### Returns

`string`

#### Implementation of

[BreadboardNode](../interfaces/BreadboardNode.md).[id](../interfaces/BreadboardNode.md#id)

#### Defined in

[seeds/breadboard/src/node.ts:169](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/node.ts#L169)

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

[seeds/breadboard/src/node.ts:138](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/node.ts#L138)
