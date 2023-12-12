[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / Node

# Class: Node<Inputs, Outputs\>

## Type parameters

| Name      |
| :-------- |
| `Inputs`  |
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

| Name      |
| :-------- |
| `Inputs`  |
| `Outputs` |

#### Parameters

| Name             | Type                                                                         |
| :--------------- | :--------------------------------------------------------------------------- |
| `breadboard`     | `Breadboard`                                                                 |
| `kit`            | `undefined` \| [`Kit`](../interfaces/Kit.md)                                 |
| `type`           | `string`                                                                     |
| `configuration?` | [`NodeConfigurationConstructor`](../modules.md#nodeconfigurationconstructor) |
| `id?`            | `string`                                                                     |

#### Defined in

[seeds/breadboard/src/node.ts:101](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/node.ts#L101)

## Properties

### #breadboard

• `Private` **#breadboard**: `Breadboard`

#### Defined in

[seeds/breadboard/src/node.ts:99](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/node.ts#L99)

---

### #descriptor

• `Private` **#descriptor**: [`NodeDescriptor`](../modules.md#nodedescriptor)

#### Defined in

[seeds/breadboard/src/node.ts:98](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/node.ts#L98)

## Accessors

### id

• `get` **id**(): `string`

#### Returns

`string`

#### Implementation of

[BreadboardNode](../interfaces/BreadboardNode.md).[id](../interfaces/BreadboardNode.md#id)

#### Defined in

[seeds/breadboard/src/node.ts:167](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/node.ts#L167)

## Methods

### wire

▸ **wire**<`ToInputs`, `ToOutputs`\>(`spec`, `to`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`Inputs`, `Outputs`\>

Wires the current node to another node.

Use this method to wire nodes together.

#### Type parameters

| Name        |
| :---------- |
| `ToInputs`  |
| `ToOutputs` |

#### Parameters

| Name   | Type                                                                          | Description                                                                                                                                    |
| :----- | :---------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `spec` | `string`                                                                      | the wiring spec. See the [wiring spec](https://github.com/breadboard-ai/breadboard/blob/main/seeds/breadboard/docs/wires.md) for more details. |
| `to`   | [`BreadboardNode`](../interfaces/BreadboardNode.md)<`ToInputs`, `ToOutputs`\> | the node to wire this node with.                                                                                                               |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`Inputs`, `Outputs`\>

- the current node, to enable chaining.

#### Implementation of

[BreadboardNode](../interfaces/BreadboardNode.md).[wire](../interfaces/BreadboardNode.md#wire)

#### Defined in

[seeds/breadboard/src/node.ts:136](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/node.ts#L136)
