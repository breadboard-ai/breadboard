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

- [$schema](Breadboard.md#$schema)
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

### $schema

• `Optional` **$schema**: `string`

The schema of the graph.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[$schema](BreadboardRunner.md#$schema)

#### Defined in

[packages/breadboard/src/types.ts:171](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L171)

___

### args

• `Optional` **args**: [`InputValues`](../modules.md#inputvalues)

Arguments that are passed to the graph, useful to bind values to lambdas.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[args](BreadboardRunner.md#args)

#### Defined in

[packages/breadboard/src/types.ts:234](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L234)

___

### description

• `Optional` **description**: `string`

The description of the graph.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[description](BreadboardRunner.md#description)

#### Defined in

[packages/breadboard/src/types.ts:187](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L187)

___

### edges

• **edges**: [`Edge`](../modules.md#edge)[]

The collection of all edges in the graph.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[edges](BreadboardRunner.md#edges)

#### Defined in

[packages/breadboard/src/types.ts:214](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L214)

___

### graphs

• `Optional` **graphs**: [`SubGraphs`](../modules.md#subgraphs)

Sub-graphs that are also described by this graph representation.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[graphs](BreadboardRunner.md#graphs)

#### Defined in

[packages/breadboard/src/types.ts:229](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L229)

___

### kits

• **kits**: [`Kit`](Kit.md)[]

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[kits](BreadboardRunner.md#kits)

#### Defined in

[packages/breadboard/src/types.ts:650](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L650)

___

### nodes

• **nodes**: [`NodeDescriptor`](../modules.md#nodedescriptor)[]

The collection of all nodes in the graph.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[nodes](BreadboardRunner.md#nodes)

#### Defined in

[packages/breadboard/src/types.ts:219](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L219)

___

### title

• `Optional` **title**: `string`

The title of the graph.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[title](BreadboardRunner.md#title)

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

[BreadboardRunner](BreadboardRunner.md).[url](BreadboardRunner.md#url)

#### Defined in

[packages/breadboard/src/types.ts:179](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L179)

___

### version

• `Optional` **version**: `string`

Version of the graph.
[semver](https://semver.org/) format is encouraged.

#### Inherited from

[BreadboardRunner](BreadboardRunner.md).[version](BreadboardRunner.md#version)

#### Defined in

[packages/breadboard/src/types.ts:192](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L192)

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

[packages/breadboard/src/types.ts:666](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L666)

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

[packages/breadboard/src/types.ts:670](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L670)

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

[packages/breadboard/src/types.ts:668](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L668)

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

[packages/breadboard/src/types.ts:667](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L667)

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

[packages/breadboard/src/types.ts:651](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L651)

___

### currentBoardToAddTo

▸ **currentBoardToAddTo**(): [`Breadboard`](Breadboard.md)

#### Returns

[`Breadboard`](Breadboard.md)

#### Defined in

[packages/breadboard/src/types.ts:669](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L669)

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

[packages/breadboard/src/types.ts:655](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L655)

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

[packages/breadboard/src/types.ts:661](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L661)

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

[packages/breadboard/src/types.ts:658](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L658)

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

[BreadboardRunner](BreadboardRunner.md).[runOnce](BreadboardRunner.md#runonce)

#### Defined in

[packages/breadboard/src/types.ts:643](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L643)
