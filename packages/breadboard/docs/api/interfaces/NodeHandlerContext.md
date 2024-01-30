[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / NodeHandlerContext

# Interface: NodeHandlerContext

## Table of contents

### Properties

- [base](NodeHandlerContext.md#base)
- [board](NodeHandlerContext.md#board)
- [descriptor](NodeHandlerContext.md#descriptor)
- [invocationPath](NodeHandlerContext.md#invocationpath)
- [kits](NodeHandlerContext.md#kits)
- [outerGraph](NodeHandlerContext.md#outergraph)
- [probe](NodeHandlerContext.md#probe)
- [requestInput](NodeHandlerContext.md#requestinput)
- [slots](NodeHandlerContext.md#slots)
- [state](NodeHandlerContext.md#state)

## Properties

### base

• `Optional` `Readonly` **base**: `URL`

#### Defined in

[packages/breadboard/src/types.ts:676](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L676)

___

### board

• `Optional` `Readonly` **board**: [`BreadboardRunner`](BreadboardRunner.md)

#### Defined in

[packages/breadboard/src/types.ts:673](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L673)

___

### descriptor

• `Optional` `Readonly` **descriptor**: [`NodeDescriptor`](../modules.md#nodedescriptor)

#### Defined in

[packages/breadboard/src/types.ts:674](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L674)

___

### invocationPath

• `Optional` `Readonly` **invocationPath**: `number`[]

#### Defined in

[packages/breadboard/src/types.ts:685](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L685)

___

### kits

• `Optional` `Readonly` **kits**: [`Kit`](Kit.md)[]

#### Defined in

[packages/breadboard/src/types.ts:675](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L675)

___

### outerGraph

• `Optional` `Readonly` **outerGraph**: [`GraphDescriptor`](../modules.md#graphdescriptor)

#### Defined in

[packages/breadboard/src/types.ts:677](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L677)

___

### probe

• `Optional` `Readonly` **probe**: [`Probe`](Probe.md)

#### Defined in

[packages/breadboard/src/types.ts:679](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L679)

___

### requestInput

• `Optional` `Readonly` **requestInput**: (`name`: `string`, `schema`: [`Schema`](../modules.md#schema), `node`: [`NodeDescriptor`](../modules.md#nodedescriptor)) => `Promise`\<[`NodeValue`](../modules.md#nodevalue)\>

#### Type declaration

▸ (`name`, `schema`, `node`): `Promise`\<[`NodeValue`](../modules.md#nodevalue)\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `schema` | [`Schema`](../modules.md#schema) |
| `node` | [`NodeDescriptor`](../modules.md#nodedescriptor) |

##### Returns

`Promise`\<[`NodeValue`](../modules.md#nodevalue)\>

#### Defined in

[packages/breadboard/src/types.ts:680](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L680)

___

### slots

• `Optional` `Readonly` **slots**: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec)

#### Defined in

[packages/breadboard/src/types.ts:678](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L678)

___

### state

• `Optional` `Readonly` **state**: [`RunState`](../modules.md#runstate)

#### Defined in

[packages/breadboard/src/types.ts:686](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L686)
