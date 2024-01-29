[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / Breadboard

# Interface: Breadboard

Represents a graph.

## Hierarchy

- [`BreadboardRunner`](BreadboardRunner.md)

  ↳ **`Breadboard`**

## Implemented by

- [`Board`](../classes/Board.md)

## Table of contents

### Properties

- [args](Breadboard.md#args)
- [description](Breadboard.md#description)
- [edges](Breadboard.md#edges)
- [graphs](Breadboard.md#graphs)
- [kits](Breadboard.md#kits)
- [nodes](Breadboard.md#nodes)
- [title](Breadboard.md#title)
- [url](Breadboard.md#url)
- [version](Breadboard.md#version)

### Methods

- [addEdge](Breadboard.md#addedge)
- [addEdgeAcrossBoards](Breadboard.md#addedgeacrossboards)
- [addKit](Breadboard.md#addkit)
- [addNode](Breadboard.md#addnode)
- [addValidator](Breadboard.md#addvalidator)
- [currentBoardToAddTo](Breadboard.md#currentboardtoaddto)
- [input](Breadboard.md#input)
- [lambda](Breadboard.md#lambda)
- [output](Breadboard.md#output)
- [run](Breadboard.md#run)
- [runOnce](Breadboard.md#runonce)

## Properties

### args

• `Optional` **args**: [`InputValues`](../modules.md#inputvalues)

Arguments that are passed to the graph, useful to bind values to lambdas.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[args](BreadboardRunner.md#args)

#### Defined in

[packages/breadboard/src/types.ts:228](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L228)

___

### description

• `Optional` **description**: `string`

The description of the graph.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[description](BreadboardRunner.md#description)

#### Defined in

[packages/breadboard/src/types.ts:181](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L181)

___

### edges

• **edges**: [`Edge`](../modules.md#edge)[]

The collection of all edges in the graph.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[edges](BreadboardRunner.md#edges)

#### Defined in

[packages/breadboard/src/types.ts:208](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L208)

___

### graphs

• `Optional` **graphs**: [`SubGraphs`](../modules.md#subgraphs)

Sub-graphs that are also described by this graph representation.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[graphs](BreadboardRunner.md#graphs)

#### Defined in

[packages/breadboard/src/types.ts:223](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L223)

___

### kits

• **kits**: [`Kit`](Kit.md)[]

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[kits](BreadboardRunner.md#kits)

#### Defined in

[packages/breadboard/src/types.ts:644](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L644)

___

### nodes

• **nodes**: [`NodeDescriptor`](../modules.md#nodedescriptor)[]

The collection of all nodes in the graph.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[nodes](BreadboardRunner.md#nodes)

#### Defined in

[packages/breadboard/src/types.ts:213](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L213)

___

### title

• `Optional` **title**: `string`

The title of the graph.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[title](BreadboardRunner.md#title)

#### Defined in

[packages/breadboard/src/types.ts:177](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L177)

___

### url

• `Optional` **url**: `string`

The URL pointing to the location of the graph.
This URL is used to resolve relative paths in the graph.
If not specified, the paths are assumed to be relative to the current
working directory.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[url](BreadboardRunner.md#url)

#### Defined in

[packages/breadboard/src/types.ts:173](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L173)

___

### version

• `Optional` **version**: `string`

Version of the graph.
[semver](https://semver.org/) format is encouraged.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[version](BreadboardRunner.md#version)

#### Defined in

[packages/breadboard/src/types.ts:186](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L186)

## Methods

### addEdge

▸ **addEdge**(`edge`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `edge` | [`Edge`](../modules.md#edge) |

#### Returns

`void`

#### Defined in

[packages/breadboard/src/types.ts:660](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L660)

___

### addEdgeAcrossBoards

▸ **addEdgeAcrossBoards**(`edge`, `from`, `to`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `edge` | [`Edge`](../modules.md#edge) |
| `from` | [`Breadboard`](Breadboard.md) |
| `to` | [`Breadboard`](Breadboard.md) |

#### Returns

`void`

#### Defined in

[packages/breadboard/src/types.ts:664](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L664)

___

### addKit

▸ **addKit**\<`T`\>(`ctr`): `T`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Kit`](Kit.md) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `ctr` | [`KitConstructor`](KitConstructor.md)\<`T`\> |

#### Returns

`T`

#### Defined in

[packages/breadboard/src/types.ts:662](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L662)

___

### addNode

▸ **addNode**(`node`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | [`NodeDescriptor`](../modules.md#nodedescriptor) |

#### Returns

`void`

#### Defined in

[packages/breadboard/src/types.ts:661](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L661)

___

### addValidator

▸ **addValidator**(`validator`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `validator` | [`BreadboardValidator`](BreadboardValidator.md) |

#### Returns

`void`

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[addValidator](BreadboardRunner.md#addvalidator)

#### Defined in

[packages/breadboard/src/types.ts:645](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L645)

___

### currentBoardToAddTo

▸ **currentBoardToAddTo**(): [`Breadboard`](Breadboard.md)

#### Returns

[`Breadboard`](Breadboard.md)

#### Defined in

[packages/breadboard/src/types.ts:663](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L663)

___

### input

▸ **input**\<`In`, `Out`\>(`config?`): [`BreadboardNode`](BreadboardNode.md)\<`In`, `Out`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | [`InputValues`](../modules.md#inputvalues) |
| `Out` | `Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `config?` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) |

#### Returns

[`BreadboardNode`](BreadboardNode.md)\<`In`, `Out`\>

#### Defined in

[packages/breadboard/src/types.ts:649](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L649)

___

### lambda

▸ **lambda**\<`In`, `InL`, `OutL`\>(`boardOrFunction`, `config?`): [`BreadboardNode`](BreadboardNode.md)\<`In`, [`LambdaNodeOutputs`](../modules.md#lambdanodeoutputs)\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `In` |
| `InL` | `InL` |
| `OutL` | `Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `boardOrFunction` | [`BreadboardRunner`](BreadboardRunner.md) \| [`LambdaFunction`](../modules.md#lambdafunction)\<`InL`, `OutL`\> |
| `config?` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) |

#### Returns

[`BreadboardNode`](BreadboardNode.md)\<`In`, [`LambdaNodeOutputs`](../modules.md#lambdanodeoutputs)\>

#### Defined in

[packages/breadboard/src/types.ts:655](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L655)

___

### output

▸ **output**\<`In`, `Out`\>(`config?`): [`BreadboardNode`](BreadboardNode.md)\<`In`, `Out`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | [`InputValues`](../modules.md#inputvalues) |
| `Out` | `Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `config?` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) |

#### Returns

[`BreadboardNode`](BreadboardNode.md)\<`In`, `Out`\>

#### Defined in

[packages/breadboard/src/types.ts:652](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L652)

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

[BreadboardRunner](BreadboardRunner.md).[run](BreadboardRunner.md#run)

#### Defined in

[packages/breadboard/src/types.ts:633](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L633)

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

[BreadboardRunner](BreadboardRunner.md).[runOnce](BreadboardRunner.md#runonce)

#### Defined in

[packages/breadboard/src/types.ts:637](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L637)
