[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / BreadboardRunner

# Interface: BreadboardRunner

Represents a graph.

## Hierarchy

- [`GraphDescriptor`](../modules.md#graphdescriptor)

- [`RunnerLike`](RunnerLike.md)

  ↳ **`BreadboardRunner`**

  ↳↳ [`Breadboard`](Breadboard.md)

## Implemented by

- [`BoardRunner`](../classes/BoardRunner.md)
- [`Runner`](../classes/Runner.md)

## Table of contents

### Properties

- [$schema](BreadboardRunner.md#$schema)
- [args](BreadboardRunner.md#args)
- [description](BreadboardRunner.md#description)
- [edges](BreadboardRunner.md#edges)
- [graphs](BreadboardRunner.md#graphs)
- [kits](BreadboardRunner.md#kits)
- [nodes](BreadboardRunner.md#nodes)
- [title](BreadboardRunner.md#title)
- [url](BreadboardRunner.md#url)
- [version](BreadboardRunner.md#version)

### Methods

- [addValidator](BreadboardRunner.md#addvalidator)
- [run](BreadboardRunner.md#run)
- [runOnce](BreadboardRunner.md#runonce)

## Properties

### $schema

• `Optional` **$schema**: `string`

The schema of the graph.

#### Inherited from

GraphDescriptor.$schema

#### Defined in

[packages/breadboard/src/types.ts:171](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L171)

___

### args

• `Optional` **args**: [`InputValues`](../modules.md#inputvalues)

Arguments that are passed to the graph, useful to bind values to lambdas.

#### Inherited from

GraphDescriptor.args

#### Defined in

[packages/breadboard/src/types.ts:234](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L234)

___

### description

• `Optional` **description**: `string`

The description of the graph.

#### Inherited from

GraphDescriptor.description

#### Defined in

[packages/breadboard/src/types.ts:187](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L187)

___

### edges

• **edges**: [`Edge`](../modules.md#edge)[]

The collection of all edges in the graph.

#### Inherited from

GraphDescriptor.edges

#### Defined in

[packages/breadboard/src/types.ts:214](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L214)

___

### graphs

• `Optional` **graphs**: [`SubGraphs`](../modules.md#subgraphs)

Sub-graphs that are also described by this graph representation.

#### Inherited from

GraphDescriptor.graphs

#### Defined in

[packages/breadboard/src/types.ts:229](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L229)

___

### kits

• **kits**: [`Kit`](Kit.md)[]

#### Overrides

GraphDescriptor.kits

#### Defined in

[packages/breadboard/src/types.ts:650](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L650)

___

### nodes

• **nodes**: [`NodeDescriptor`](../modules.md#nodedescriptor)[]

The collection of all nodes in the graph.

#### Inherited from

GraphDescriptor.nodes

#### Defined in

[packages/breadboard/src/types.ts:219](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L219)

___

### title

• `Optional` **title**: `string`

The title of the graph.

#### Inherited from

GraphDescriptor.title

#### Defined in

[packages/breadboard/src/types.ts:183](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L183)

___

### url

• `Optional` **url**: `string`

The URL pointing to the location of the graph.
This URL is used to resolve relative paths in the graph.
If not specified, the paths are assumed to be relative to the current
working directory.

#### Inherited from

GraphDescriptor.url

#### Defined in

[packages/breadboard/src/types.ts:179](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L179)

___

### version

• `Optional` **version**: `string`

Version of the graph.
[semver](https://semver.org/) format is encouraged.

#### Inherited from

GraphDescriptor.version

#### Defined in

[packages/breadboard/src/types.ts:192](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L192)

## Methods

### addValidator

▸ **addValidator**(`validator`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `validator` | [`BreadboardValidator`](BreadboardValidator.md) |

#### Returns

`void`

#### Defined in

[packages/breadboard/src/types.ts:651](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L651)

___

### run

▸ **run**(`context?`, `result?`): `AsyncGenerator`\<[`BreadboardRunResult`](BreadboardRunResult.md), `any`, `unknown`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `context?` | [`NodeHandlerContext`](NodeHandlerContext.md) |
| `result?` | [`BreadboardRunResult`](BreadboardRunResult.md) |

#### Returns

`AsyncGenerator`\<[`BreadboardRunResult`](BreadboardRunResult.md), `any`, `unknown`\>

#### Inherited from

[RunnerLike](RunnerLike.md).[run](RunnerLike.md#run)

#### Defined in

[packages/breadboard/src/types.ts:639](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L639)

___

### runOnce

▸ **runOnce**(`inputs`, `context?`): `Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`InputValues`](../modules.md#inputvalues) |
| `context?` | [`NodeHandlerContext`](NodeHandlerContext.md) |

#### Returns

`Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Inherited from

[RunnerLike](RunnerLike.md).[runOnce](RunnerLike.md#runonce)

#### Defined in

[packages/breadboard/src/types.ts:643](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L643)
