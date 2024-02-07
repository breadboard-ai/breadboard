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

[packages/breadboard/src/types.ts:682](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L682)

___

### board

• `Optional` `Readonly` **board**: [`BreadboardRunner`](BreadboardRunner.md)

#### Defined in

[packages/breadboard/src/types.ts:679](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L679)

___

### descriptor

• `Optional` `Readonly` **descriptor**: [`NodeDescriptor`](../modules.md#nodedescriptor)

#### Defined in

[packages/breadboard/src/types.ts:680](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L680)

___

### invocationPath

• `Optional` `Readonly` **invocationPath**: `number`[]

#### Defined in

[packages/breadboard/src/types.ts:691](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L691)

___

### kits

• `Optional` `Readonly` **kits**: [`Kit`](Kit.md)[]

#### Defined in

[packages/breadboard/src/types.ts:681](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L681)

___

### outerGraph

• `Optional` `Readonly` **outerGraph**: [`GraphDescriptor`](../modules.md#graphdescriptor)

#### Defined in

[packages/breadboard/src/types.ts:683](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L683)

___

### probe

• `Optional` `Readonly` **probe**: [`Probe`](Probe.md)

#### Defined in

[packages/breadboard/src/types.ts:685](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L685)

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

[packages/breadboard/src/types.ts:686](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L686)

___

### slots

• `Optional` `Readonly` **slots**: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec)

#### Defined in

[packages/breadboard/src/types.ts:684](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L684)

___

### state

• `Optional` `Readonly` **state**: [`RunState`](../modules.md#runstate)

#### Defined in

[packages/breadboard/src/types.ts:692](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L692)
