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
- [fromGraphDescriptor](Runner.md#fromgraphdescriptor)
- [load](Runner.md#load)

## Constructors

### constructor

• **new Runner**(): [`Runner`](Runner.md)

#### Returns

[`Runner`](Runner.md)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:115](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L115)

## Properties

### #anyNode

• `Private` `Optional` **#anyNode**: [`AbstractNode`](AbstractNode.md)\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\>

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:113](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L113)

___

### #scope

• `Private` **#scope**: `Scope`

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:112](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L112)

___

### args

• `Optional` **args**: [`InputValues`](../modules.md#inputvalues)

Arguments that are passed to the graph, useful to bind values to lambdas.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[args](../interfaces/BreadboardRunner.md#args)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:110](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L110)

___

### edges

• **edges**: [`Edge`](../modules.md#edge)[] = `[]`

The collection of all edges in the graph.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[edges](../interfaces/BreadboardRunner.md#edges)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:108](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L108)

___

### kits

• **kits**: [`Kit`](../interfaces/Kit.md)[] = `[]`

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[kits](../interfaces/BreadboardRunner.md#kits)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:107](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L107)

___

### nodes

• **nodes**: [`NodeDescriptor`](../modules.md#nodedescriptor)[] = `[]`

The collection of all nodes in the graph.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[nodes](../interfaces/BreadboardRunner.md#nodes)

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:109](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L109)

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

[packages/breadboard/src/new/runner/runner.ts:223](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L223)

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

[packages/breadboard/src/new/runner/runner.ts:119](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L119)

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

[packages/breadboard/src/new/runner/runner.ts:200](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L200)

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

[packages/breadboard/src/new/runner/runner.ts:227](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L227)

___

### load

▸ **load**(`url`, `options`): `Promise`\<[`Runner`](Runner.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |
| `options` | `Object` |
| `options.base` | `URL` |
| `options.outerGraph?` | [`GraphDescriptor`](../modules.md#graphdescriptor) |

#### Returns

`Promise`\<[`Runner`](Runner.md)\>

#### Defined in

[packages/breadboard/src/new/runner/runner.ts:259](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/runner.ts#L259)
