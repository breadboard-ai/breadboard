[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / BreadboardRunner

# Interface: BreadboardRunner

Represents a graph.

## Hierarchy

- [`GraphDescriptor`](../modules.md#graphdescriptor)

- `RunnerLike`

  ↳ **`BreadboardRunner`**

## Implemented by

- [`BoardRunner`](../classes/BoardRunner.md)
- [`Runner`](../classes/Runner.md)

## Table of contents

### Properties

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

### args

• `Optional` **args**: [`InputValues`](../modules.md#inputvalues)

Arguments that are passed to the graph, useful to bind values to lambdas.

#### Inherited from

GraphDescriptor.args

#### Defined in

[packages/breadboard/src/types.ts:228](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L228)

___

### description

• `Optional` **description**: `string`

The description of the graph.

#### Inherited from

GraphDescriptor.description

#### Defined in

[packages/breadboard/src/types.ts:181](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L181)

___

### edges

• **edges**: [`Edge`](../modules.md#edge)[]

The collection of all edges in the graph.

#### Inherited from

GraphDescriptor.edges

#### Defined in

[packages/breadboard/src/types.ts:208](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L208)

___

### graphs

• `Optional` **graphs**: [`SubGraphs`](../modules.md#subgraphs)

Sub-graphs that are also described by this graph representation.

#### Inherited from

GraphDescriptor.graphs

#### Defined in

[packages/breadboard/src/types.ts:223](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L223)

___

### kits

• **kits**: [`Kit`](Kit.md)[]

#### Overrides

GraphDescriptor.kits

#### Defined in

[packages/breadboard/src/types.ts:502](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L502)

___

### nodes

• **nodes**: [`NodeDescriptor`](../modules.md#nodedescriptor)[]

The collection of all nodes in the graph.

#### Inherited from

GraphDescriptor.nodes

#### Defined in

[packages/breadboard/src/types.ts:213](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L213)

___

### title

• `Optional` **title**: `string`

The title of the graph.

#### Inherited from

GraphDescriptor.title

#### Defined in

[packages/breadboard/src/types.ts:177](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L177)

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

[packages/breadboard/src/types.ts:173](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L173)

___

### version

• `Optional` **version**: `string`

Version of the graph.
[semver](https://semver.org/) format is encouraged.

#### Inherited from

GraphDescriptor.version

#### Defined in

[packages/breadboard/src/types.ts:186](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L186)

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

[packages/breadboard/src/types.ts:503](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L503)

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

RunnerLike.run

#### Defined in

[packages/breadboard/src/types.ts:491](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L491)

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

RunnerLike.runOnce

#### Defined in

[packages/breadboard/src/types.ts:495](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L495)
