[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / BoardRunner

# Class: BoardRunner

This class is the main entry point for running a board.

It contains everything that is needed to run a board, either loaded from a
serialized board or created via the {Board} class.

See the {Board} class for a way to build a board that can also be serialized.

## Hierarchy

- **`BoardRunner`**

  ↳ [`Board`](Board.md)

## Implements

- [`BreadboardRunner`](../interfaces/BreadboardRunner.md)

## Table of contents

### Constructors

- [constructor](BoardRunner.md#constructor)

### Properties

- [#outerGraph](BoardRunner.md##outergraph)
- [#slots](BoardRunner.md##slots)
- [#validators](BoardRunner.md##validators)
- [args](BoardRunner.md#args)
- [description](BoardRunner.md#description)
- [edges](BoardRunner.md#edges)
- [graphs](BoardRunner.md#graphs)
- [kits](BoardRunner.md#kits)
- [nodes](BoardRunner.md#nodes)
- [title](BoardRunner.md#title)
- [url](BoardRunner.md#url)
- [version](BoardRunner.md#version)
- [runRemote](BoardRunner.md#runremote)

### Methods

- [addValidator](BoardRunner.md#addvalidator)
- [mermaid](BoardRunner.md#mermaid)
- [run](BoardRunner.md#run)
- [runOnce](BoardRunner.md#runonce)
- [fromBreadboardCapability](BoardRunner.md#frombreadboardcapability)
- [fromGraphDescriptor](BoardRunner.md#fromgraphdescriptor)
- [handlersFromBoard](BoardRunner.md#handlersfromboard)
- [load](BoardRunner.md#load)

## Constructors

### constructor

• **new BoardRunner**(`metadata?`): [`BoardRunner`](BoardRunner.md)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `metadata?` | [`GraphMetadata`](../modules.md#graphmetadata) | optional metadata for the board. Use this parameter to provide title, description, version, and URL for the board. |

#### Returns

[`BoardRunner`](BoardRunner.md)

#### Defined in

[packages/breadboard/src/runner.ts:80](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L80)

## Properties

### #outerGraph

• `Private` `Optional` **#outerGraph**: [`GraphDescriptor`](../modules.md#graphdescriptor)

The parent board, if this is board is a subgraph of a larger board.

#### Defined in

[packages/breadboard/src/runner.ts:73](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L73)

___

### #slots

• `Private` **#slots**: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) = `{}`

#### Defined in

[packages/breadboard/src/runner.ts:68](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L68)

___

### #validators

• `Private` **#validators**: [`BreadboardValidator`](../interfaces/BreadboardValidator.md)[] = `[]`

#### Defined in

[packages/breadboard/src/runner.ts:69](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L69)

___

### args

• `Optional` **args**: [`InputValues`](../modules.md#inputvalues)

Arguments that are passed to the graph, useful to bind values to lambdas.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[args](../interfaces/BreadboardRunner.md#args)

#### Defined in

[packages/breadboard/src/runner.ts:66](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L66)

___

### description

• `Optional` **description**: `string`

The description of the graph.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[description](../interfaces/BreadboardRunner.md#description)

#### Defined in

[packages/breadboard/src/runner.ts:60](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L60)

___

### edges

• **edges**: [`Edge`](../modules.md#edge)[] = `[]`

The collection of all edges in the graph.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[edges](../interfaces/BreadboardRunner.md#edges)

#### Defined in

[packages/breadboard/src/runner.ts:62](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L62)

___

### graphs

• `Optional` **graphs**: [`SubGraphs`](../modules.md#subgraphs)

Sub-graphs that are also described by this graph representation.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[graphs](../interfaces/BreadboardRunner.md#graphs)

#### Defined in

[packages/breadboard/src/runner.ts:65](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L65)

___

### kits

• **kits**: [`Kit`](../interfaces/Kit.md)[] = `[]`

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[kits](../interfaces/BreadboardRunner.md#kits)

#### Defined in

[packages/breadboard/src/runner.ts:64](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L64)

___

### nodes

• **nodes**: [`NodeDescriptor`](../modules.md#nodedescriptor)[] = `[]`

The collection of all nodes in the graph.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[nodes](../interfaces/BreadboardRunner.md#nodes)

#### Defined in

[packages/breadboard/src/runner.ts:63](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L63)

___

### title

• `Optional` **title**: `string`

The title of the graph.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[title](../interfaces/BreadboardRunner.md#title)

#### Defined in

[packages/breadboard/src/runner.ts:59](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L59)

___

### url

• `Optional` **url**: `string`

The URL pointing to the location of the graph.
This URL is used to resolve relative paths in the graph.
If not specified, the paths are assumed to be relative to the current
working directory.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[url](../interfaces/BreadboardRunner.md#url)

#### Defined in

[packages/breadboard/src/runner.ts:58](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L58)

___

### version

• `Optional` **version**: `string`

Version of the graph.
[semver](https://semver.org/) format is encouraged.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[version](../interfaces/BreadboardRunner.md#version)

#### Defined in

[packages/breadboard/src/runner.ts:61](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L61)

___

### runRemote

▪ `Static` **runRemote**: (`url`: `string`) => `AsyncGenerator`\<`RemoteRunResult`, `void`, `unknown`\> = `runRemote`

#### Type declaration

▸ (`url`): `AsyncGenerator`\<`RemoteRunResult`, `void`, `unknown`\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |

##### Returns

`AsyncGenerator`\<`RemoteRunResult`, `void`, `unknown`\>

#### Defined in

[packages/breadboard/src/runner.ts:384](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L384)

## Methods

### addValidator

▸ **addValidator**(`validator`): `void`

Add validator to the board.
Will call .addGraph() on the validator before executing a graph.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `validator` | [`BreadboardValidator`](../interfaces/BreadboardValidator.md) | a validator to add to the board. |

#### Returns

`void`

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[addValidator](../interfaces/BreadboardRunner.md#addvalidator)

#### Defined in

[packages/breadboard/src/runner.ts:277](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L277)

___

### mermaid

▸ **mermaid**(`direction?`, `unstyled?`): `string`

Returns a [Mermaid](https://mermaid-js.github.io/mermaid/#/) representation
of the board.

This is useful for visualizing the board.

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `direction` | `string` | `"TD"` |
| `unstyled` | `boolean` | `false` |

#### Returns

`string`

- a string containing the Mermaid representation of the board.

#### Defined in

[packages/breadboard/src/runner.ts:289](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L289)

___

### run

▸ **run**(`context?`, `result?`): `AsyncGenerator`\<[`RunResult`](RunResult.md), `any`, `unknown`\>

Runs the board. This method is an async generator that
yields the results of each stage of the run.

Conceptually, when we ask the board to run, it will occasionally pause
and give us a chance to interact with it.

It's typically used like this:

```js
for await (const stop of board.run()) {
// do something with `stop`
}
```

The `stop` iterator result will be a `RunResult` and provide ability
to influence running of the board.

The two key use cases are providing input and receiving output.

If `stop.type` is `input`, the board is waiting for input values.
When that is the case, use `stop.inputs` to provide input values.

If `stop.type` is `output`, the board is providing output values.
When that is the case, use `stop.outputs` to receive output values.

See [Chapter 8: Continuous runs](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard/docs/tutorial#chapter-8-continuous-runs) of Breadboard tutorial for an example of how to use this method.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `context` | [`NodeHandlerContext`](../interfaces/NodeHandlerContext.md) | - |
| `result?` | [`RunResult`](RunResult.md) | an optional result of a previous run. If provided, the board will resume from the state of the previous run. |

#### Returns

`AsyncGenerator`\<[`RunResult`](RunResult.md), `any`, `unknown`\>

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[run](../interfaces/BreadboardRunner.md#run)

#### Defined in

[packages/breadboard/src/runner.ts:120](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L120)

___

### runOnce

▸ **runOnce**(`inputs`, `context?`): `Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

A simplified version of `run` that runs the board until the board provides
an output, and returns that output.

This is useful for running boards that don't have multiple outputs
or the the outputs are only expected to be visited once.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `inputs` | [`InputValues`](../modules.md#inputvalues) | the input values to provide to the board. |
| `context` | [`NodeHandlerContext`](../interfaces/NodeHandlerContext.md) | - |

#### Returns

`Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

- outputs provided by the board.

#### Implementation of

[BreadboardRunner](../interfaces/BreadboardRunner.md).[runOnce](../interfaces/BreadboardRunner.md#runonce)

#### Defined in

[packages/breadboard/src/runner.ts:232](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L232)

___

### fromBreadboardCapability

▸ **fromBreadboardCapability**(`board`): `Promise`\<[`BoardRunner`](BoardRunner.md)\>

Creates a runnable board from a BreadboardCapability,

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `board` | [`BreadboardCapability`](../modules.md#breadboardcapability) | {BreadboardCapability} A BreadboardCapability including a board |

#### Returns

`Promise`\<[`BoardRunner`](BoardRunner.md)\>

A runnable board.

#### Defined in

[packages/breadboard/src/runner.ts:343](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L343)

___

### fromGraphDescriptor

▸ **fromGraphDescriptor**(`graph`): `Promise`\<[`BoardRunner`](BoardRunner.md)\>

Creates a new board from JSON. If you have a serialized board, you can
use this method to turn it into into a new Board instance.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `graph` | [`GraphDescriptor`](../modules.md#graphdescriptor) | the JSON representation of the board. |

#### Returns

`Promise`\<[`BoardRunner`](BoardRunner.md)\>

- a new `Board` instance.

#### Defined in

[packages/breadboard/src/runner.ts:300](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L300)

___

### handlersFromBoard

▸ **handlersFromBoard**(`board`, `upstreamKits?`): `Promise`\<[`NodeHandlers`](../modules.md#nodehandlers)\>

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `board` | [`BoardRunner`](BoardRunner.md) | `undefined` |
| `upstreamKits` | [`Kit`](../interfaces/Kit.md)[] | `[]` |

#### Returns

`Promise`\<[`NodeHandlers`](../modules.md#nodehandlers)\>

#### Defined in

[packages/breadboard/src/runner.ts:367](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L367)

___

### load

▸ **load**(`url`, `options?`): `Promise`\<[`BoardRunner`](BoardRunner.md)\>

Loads a board from a URL or a file path.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `url` | `string` | the URL or a file path to the board. |
| `options?` | `Object` | - |
| `options.base?` | `string` | - |
| `options.outerGraph?` | [`GraphDescriptor`](../modules.md#graphdescriptor) | - |
| `options.slotted?` | [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) | - |

#### Returns

`Promise`\<[`BoardRunner`](BoardRunner.md)\>

- a new `Board` instance.

#### Defined in

[packages/breadboard/src/runner.ts:318](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L318)
