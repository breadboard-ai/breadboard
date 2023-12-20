[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / NodeHandlerContext

# Interface: NodeHandlerContext

## Table of contents

### Properties

- [base](NodeHandlerContext.md#base)
- [board](NodeHandlerContext.md#board)
- [descriptor](NodeHandlerContext.md#descriptor)
- [kits](NodeHandlerContext.md#kits)
- [outerGraph](NodeHandlerContext.md#outergraph)
- [probe](NodeHandlerContext.md#probe)
- [requestInput](NodeHandlerContext.md#requestinput)
- [slots](NodeHandlerContext.md#slots)

## Properties

### base

• `Optional` `Readonly` **base**: `string`

#### Defined in

[packages/breadboard/src/types.ts:534](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L534)

___

### board

• `Optional` `Readonly` **board**: [`BreadboardRunner`](BreadboardRunner.md)

#### Defined in

[packages/breadboard/src/types.ts:531](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L531)

___

### descriptor

• `Optional` `Readonly` **descriptor**: [`NodeDescriptor`](../modules.md#nodedescriptor)

#### Defined in

[packages/breadboard/src/types.ts:532](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L532)

___

### kits

• `Optional` `Readonly` **kits**: [`Kit`](Kit.md)[]

#### Defined in

[packages/breadboard/src/types.ts:533](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L533)

___

### outerGraph

• `Optional` `Readonly` **outerGraph**: [`GraphDescriptor`](../modules.md#graphdescriptor)

#### Defined in

[packages/breadboard/src/types.ts:535](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L535)

___

### probe

• `Optional` `Readonly` **probe**: `EventTarget`

#### Defined in

[packages/breadboard/src/types.ts:537](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L537)

___

### requestInput

• `Optional` `Readonly` **requestInput**: (`name`: `string`, `schema`: [`Schema`](../modules.md#schema)) => `Promise`\<[`NodeValue`](../modules.md#nodevalue)\>

#### Type declaration

▸ (`name`, `schema`): `Promise`\<[`NodeValue`](../modules.md#nodevalue)\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `schema` | [`Schema`](../modules.md#schema) |

##### Returns

`Promise`\<[`NodeValue`](../modules.md#nodevalue)\>

#### Defined in

[packages/breadboard/src/types.ts:538](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L538)

___

### slots

• `Optional` `Readonly` **slots**: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec)

#### Defined in

[packages/breadboard/src/types.ts:536](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L536)
