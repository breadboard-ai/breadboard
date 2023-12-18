[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / Runner

# Class: Runner

Implements the current API, so that we can run in existing Breadboard
environments.

## Implements

- [`BreadboardRunner`](../interfaces/BreadboardRunner.md)

## Table of contents

### Constructors

- [constructor](Runner.md#constructor)

### Properties

- [#anyNode](Runner.md##anynode)
- [#scope](Runner.md##scope)
- [args](Runner.md#args)
- [edges](Runner.md#edges)
- [kits](Runner.md#kits)
- [nodes](Runner.md#nodes)

### Methods

- [addValidator](Runner.md#addvalidator)
- [run](Runner.md#run)
- [runOnce](Runner.md#runonce)
- [runOnce2](Runner.md#runonce2)
- [fromGraphDescriptor](Runner.md#fromgraphdescriptor)
- [fromNode](Runner.md#fromnode)
- [load](Runner.md#load)

## Constructors

### constructor

• **new Runner**(): [`Runner`](Runner.md)

#### Returns

[`Runner`](Runner.md)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:116](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L116)

## Properties

### #anyNode

• `Private` `Optional` **#anyNode**: [`AbstractNode`](AbstractNode.md)\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\>

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:114](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L114)

___

### #scope

• `Private` **#scope**: `Scope`

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:113](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L113)

___

### args

• `Optional` **args**: [`InputValues`](../modules.md#inputvalues)

Arguments that are passed to the graph, useful to bind values to lambdas.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[args](../interfaces/BreadboardRunner.md#args)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:111](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L111)

___

### edges

• **edges**: [`Edge`](../modules.md#edge)[] = `[]`

The collection of all edges in the graph.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[edges](../interfaces/BreadboardRunner.md#edges)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:109](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L109)

___

### kits

• **kits**: [`Kit`](../interfaces/Kit.md)[] = `[]`

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[kits](../interfaces/BreadboardRunner.md#kits)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:108](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L108)

___

### nodes

• **nodes**: [`NodeDescriptor`](../modules.md#nodedescriptor)[] = `[]`

The collection of all nodes in the graph.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[nodes](../interfaces/BreadboardRunner.md#nodes)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:110](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L110)

## Methods

### addValidator

▸ **addValidator**(`_`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `_` | [`BreadboardValidator`](../interfaces/BreadboardValidator.md) |

#### Returns

`void`

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[addValidator](../interfaces/BreadboardRunner.md#addvalidator)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:276](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L276)

___

### run

▸ **run**(`«destructured»`): `AsyncGenerator`\<[`BreadboardRunResult`](../interfaces/BreadboardRunResult.md), `any`, `unknown`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`NodeHandlerContext`](../interfaces/NodeHandlerContext.md) |

#### Returns

`AsyncGenerator`\<[`BreadboardRunResult`](../interfaces/BreadboardRunResult.md), `any`, `unknown`\>

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[run](../interfaces/BreadboardRunner.md#run)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:120](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L120)

___

### runOnce

▸ **runOnce**(`inputs`, `context?`): `Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`InputValues`](../modules.md#inputvalues) |
| `context?` | [`NodeHandlerContext`](../interfaces/NodeHandlerContext.md) |

#### Returns

`Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[runOnce](../interfaces/BreadboardRunner.md#runonce)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:201](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L201)

___

### runOnce2

▸ **runOnce2**(`inputs`, `context?`): `Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`InputValues`](../modules.md#inputvalues) |
| `context?` | [`NodeHandlerContext`](../interfaces/NodeHandlerContext.md) |

#### Returns

`Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:236](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L236)

___

### fromGraphDescriptor

▸ **fromGraphDescriptor**(`graph`): `Promise`\<[`Runner`](Runner.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `graph` | [`GraphDescriptor`](../modules.md#graphdescriptor) |

#### Returns

`Promise`\<[`Runner`](Runner.md)\>

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:290](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L290)

___

### fromNode

▸ **fromNode**(`node`, `metadata?`): `Promise`\<[`Runner`](Runner.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | [`AbstractNode`](AbstractNode.md)\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\> |
| `metadata?` | [`GraphMetadata`](../modules.md#graphmetadata) |

#### Returns

`Promise`\<[`Runner`](Runner.md)\>

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:280](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L280)

___

### load

▸ **load**(`url`, `options?`): `Promise`\<[`Runner`](Runner.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |
| `options?` | `Object` |
| `options.base?` | `string` |
| `options.outerGraph?` | [`GraphDescriptor`](../modules.md#graphdescriptor) |

#### Returns

`Promise`\<[`Runner`](Runner.md)\>

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:322](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/runner.ts#L322)
