[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / Board

# Class: Board

This is the heart of the Breadboard library.
Just like for hardware makers, the `Board` is the place where wiring of
a prototype happens.

To start making, create a new breadboard:

```js
const board = new Board();
```

For more information on how to use Breadboard, start with [Chapter 1: Hello, world?](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard/docs/tutorial#chapter-7-probes) of the tutorial.

## Hierarchy

- [`BoardRunner`](BoardRunner.md)

  ↳ **`Board`**

## Implements

- `Breadboard`

## Table of contents

### Constructors

- [constructor](Board.md#constructor)

### Properties

- [#acrossBoardsEdges](Board.md##acrossboardsedges)
- [#closureStack](Board.md##closurestack)
- [#outerGraph](Board.md##outergraph)
- [#slots](Board.md##slots)
- [#topClosure](Board.md##topclosure)
- [#validators](Board.md##validators)
- [args](Board.md#args)
- [description](Board.md#description)
- [edges](Board.md#edges)
- [graphs](Board.md#graphs)
- [kits](Board.md#kits)
- [nodes](Board.md#nodes)
- [title](Board.md#title)
- [url](Board.md#url)
- [version](Board.md#version)
- [runRemote](Board.md#runremote)

### Methods

- [addEdge](Board.md#addedge)
- [addEdgeAcrossBoards](Board.md#addedgeacrossboards)
- [addKit](Board.md#addkit)
- [addNode](Board.md#addnode)
- [addValidator](Board.md#addvalidator)
- [currentBoardToAddTo](Board.md#currentboardtoaddto)
- [input](Board.md#input)
- [lambda](Board.md#lambda)
- [mermaid](Board.md#mermaid)
- [output](Board.md#output)
- [run](Board.md#run)
- [runOnce](Board.md#runonce)
- [fromBreadboardCapability](Board.md#frombreadboardcapability)
- [fromGraphDescriptor](Board.md#fromgraphdescriptor)
- [handlersFromBoard](Board.md#handlersfromboard)
- [load](Board.md#load)

## Constructors

### constructor

• **new Board**(`metadata?`): [`Board`](Board.md)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `metadata?` | [`GraphMetadata`](../modules.md#graphmetadata) | optional metadata for the board. Use this parameter to provide title, description, version, and URL for the board. |

#### Returns

[`Board`](Board.md)

#### Inherited from

[BoardRunner](BoardRunner.md).[constructor](BoardRunner.md#constructor)

#### Defined in

[packages/breadboard/src/runner.ts:80](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L80)

## Properties

### #acrossBoardsEdges

• `Private` **#acrossBoardsEdges**: \{ `edge`: [`Edge`](../modules.md#edge) ; `from`: [`Board`](Board.md) ; `to`: [`Board`](Board.md)  }[] = `[]`

#### Defined in

[packages/breadboard/src/board.ts:46](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L46)

___

### #closureStack

• `Private` **#closureStack**: [`Board`](Board.md)[] = `[]`

#### Defined in

[packages/breadboard/src/board.ts:44](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L44)

___

### #outerGraph

• `Private` `Optional` **#outerGraph**: [`GraphDescriptor`](../modules.md#graphdescriptor)

The parent board, if this is board is a subgraph of a larger board.

#### Inherited from

[BoardRunner](BoardRunner.md).[#outerGraph](BoardRunner.md##outergraph)

#### Defined in

[packages/breadboard/src/runner.ts:73](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L73)

___

### #slots

• `Private` **#slots**: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) = `{}`

#### Inherited from

[BoardRunner](BoardRunner.md).[#slots](BoardRunner.md##slots)

#### Defined in

[packages/breadboard/src/runner.ts:68](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L68)

___

### #topClosure

• `Private` **#topClosure**: `undefined` \| [`Board`](Board.md)

#### Defined in

[packages/breadboard/src/board.ts:45](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L45)

___

### #validators

• `Private` **#validators**: [`BreadboardValidator`](../interfaces/BreadboardValidator.md)[] = `[]`

#### Inherited from

[BoardRunner](BoardRunner.md).[#validators](BoardRunner.md##validators)

#### Defined in

[packages/breadboard/src/runner.ts:69](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L69)

___

### args

• `Optional` **args**: [`InputValues`](../modules.md#inputvalues)

Arguments that are passed to the graph, useful to bind values to lambdas.

#### Implementation of

Breadboard.args

#### Inherited from

[BoardRunner](BoardRunner.md).[args](BoardRunner.md#args)

#### Defined in

[packages/breadboard/src/runner.ts:66](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L66)

___

### description

• `Optional` **description**: `string`

The description of the graph.

#### Implementation of

Breadboard.description

#### Inherited from

[BoardRunner](BoardRunner.md).[description](BoardRunner.md#description)

#### Defined in

[packages/breadboard/src/runner.ts:60](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L60)

___

### edges

• **edges**: [`Edge`](../modules.md#edge)[] = `[]`

The collection of all edges in the graph.

#### Implementation of

Breadboard.edges

#### Inherited from

[BoardRunner](BoardRunner.md).[edges](BoardRunner.md#edges)

#### Defined in

[packages/breadboard/src/runner.ts:62](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L62)

___

### graphs

• `Optional` **graphs**: [`SubGraphs`](../modules.md#subgraphs)

Sub-graphs that are also described by this graph representation.

#### Implementation of

Breadboard.graphs

#### Inherited from

[BoardRunner](BoardRunner.md).[graphs](BoardRunner.md#graphs)

#### Defined in

[packages/breadboard/src/runner.ts:65](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L65)

___

### kits

• **kits**: [`Kit`](../interfaces/Kit.md)[] = `[]`

#### Implementation of

Breadboard.kits

#### Inherited from

[BoardRunner](BoardRunner.md).[kits](BoardRunner.md#kits)

#### Defined in

[packages/breadboard/src/runner.ts:64](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L64)

___

### nodes

• **nodes**: [`NodeDescriptor`](../modules.md#nodedescriptor)[] = `[]`

The collection of all nodes in the graph.

#### Implementation of

Breadboard.nodes

#### Inherited from

[BoardRunner](BoardRunner.md).[nodes](BoardRunner.md#nodes)

#### Defined in

[packages/breadboard/src/runner.ts:63](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L63)

___

### title

• `Optional` **title**: `string`

The title of the graph.

#### Implementation of

Breadboard.title

#### Inherited from

[BoardRunner](BoardRunner.md).[title](BoardRunner.md#title)

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

Breadboard.url

#### Inherited from

[BoardRunner](BoardRunner.md).[url](BoardRunner.md#url)

#### Defined in

[packages/breadboard/src/runner.ts:58](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L58)

___

### version

• `Optional` **version**: `string`

Version of the graph.
[semver](https://semver.org/) format is encouraged.

#### Implementation of

Breadboard.version

#### Inherited from

[BoardRunner](BoardRunner.md).[version](BoardRunner.md#version)

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

#### Inherited from

[BoardRunner](BoardRunner.md).[runRemote](BoardRunner.md#runremote)

#### Defined in

[packages/breadboard/src/runner.ts:384](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L384)

## Methods

### addEdge

▸ **addEdge**(`edge`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `edge` | [`Edge`](../modules.md#edge) |

#### Returns

`void`

#### Implementation of

Breadboard.addEdge

#### Defined in

[packages/breadboard/src/board.ts:176](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L176)

___

### addEdgeAcrossBoards

▸ **addEdgeAcrossBoards**(`edge`, `from`, `to`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `edge` | [`Edge`](../modules.md#edge) |
| `from` | [`Board`](Board.md) |
| `to` | [`Board`](Board.md) |

#### Returns

`void`

#### Implementation of

Breadboard.addEdgeAcrossBoards

#### Defined in

[packages/breadboard/src/board.ts:230](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L230)

___

### addKit

▸ **addKit**\<`T`\>(`ctr`): `T`

Adds a new kit to the board.

Kits are collections of nodes that are bundled together for a specific
purpose. For example, the [LLM Starter Kit](https://github.com/breadboard-ai/breadboard/tree/main/packages/llm-starter) provides a few nodes that
are useful for making generative AI applications.

Typically, kits are distributed as NPM packages. To add a kit to the board,
simply install it using `npm` or `yarn`, and then add it to the board:

```js
import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board();
const kit = board.addKit(Starter);
```

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Kit`](../interfaces/Kit.md) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `ctr` | [`KitConstructor`](../interfaces/KitConstructor.md)\<`T`\> | the kit constructor. |

#### Returns

`T`

- the kit object, which is associated with
the board and can be used to place nodes on that board.

#### Implementation of

Breadboard.addKit

#### Defined in

[packages/breadboard/src/board.ts:206](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L206)

___

### addNode

▸ **addNode**(`node`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | [`NodeDescriptor`](../modules.md#nodedescriptor) |

#### Returns

`void`

#### Implementation of

Breadboard.addNode

#### Defined in

[packages/breadboard/src/board.ts:180](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L180)

___

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

Breadboard.addValidator

#### Inherited from

[BoardRunner](BoardRunner.md).[addValidator](BoardRunner.md#addvalidator)

#### Defined in

[packages/breadboard/src/runner.ts:277](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L277)

___

### currentBoardToAddTo

▸ **currentBoardToAddTo**(): `Breadboard`

Used in the context of board.lambda(): Returns the board that is currently
being constructed, according to the nesting level of board.lambda() calls
with JS functions.

Only called by Node constructor, when adding nodes.

#### Returns

`Breadboard`

#### Implementation of

Breadboard.currentBoardToAddTo

#### Defined in

[packages/breadboard/src/board.ts:219](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L219)

___

### input

▸ **input**\<`In`, `Out`\>(`config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)\<`In`, `Out`\>

Places an `input` node on the board.

An `input` node is a node that asks for inputs from the user.

See [`input` node reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/nodes.md#input) for more information.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | [`InputValues`](../modules.md#inputvalues) |
| `Out` | `Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)\<`In`, `Out`\>

- a `Node` object that represents the placed node.

#### Implementation of

Breadboard.input

#### Defined in

[packages/breadboard/src/board.ts:63](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L63)

___

### lambda

▸ **lambda**\<`In`, `InL`, `OutL`\>(`boardOrFunction`, `config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)\<`In`, [`LambdaNodeOutputs`](../modules.md#lambdanodeoutputs)\>

Place a `lambda` node on the board.

It is a node that represents a subgraph of nodes. It can be passed to
`invoke` or nodes like `map` (defined in another kit) that invoke boards.

Input wires are made available as input values to the lambda board.

`board` is the only output and represents a BoardCapability that invoke and
others consume.

You can either pass a `Board` or a Javascript function to this method. The
JS function is called with a `board` to add things to, and for convenience,
input and output nodes attached to the board.

Example: board.lambda((board, input, output) => { input.wire( "item->item",
kit.someNode().wire( "value->value", output));
});

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `In` |
| `InL` | `InL` |
| `OutL` | `Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `boardOrFunction` | [`BreadboardRunner`](../interfaces/BreadboardRunner.md) \| [`LambdaFunction`](../modules.md#lambdafunction)\<`InL`, `OutL`\> | A board or a function that builds the board |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)\<`In`, [`LambdaNodeOutputs`](../modules.md#lambdanodeoutputs)\>

- a `Node` object that represents the placed node.

#### Implementation of

Breadboard.lambda

#### Defined in

[packages/breadboard/src/board.ts:110](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L110)

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

#### Inherited from

[BoardRunner](BoardRunner.md).[mermaid](BoardRunner.md#mermaid)

#### Defined in

[packages/breadboard/src/runner.ts:289](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L289)

___

### output

▸ **output**\<`In`, `Out`\>(`config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)\<`In`, `Out`\>

Places an `output` node on the board.

An `output` node is a node that provides outputs to the user.

See [`output` node reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/nodes.md#output) for more information.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | [`InputValues`](../modules.md#inputvalues) |
| `Out` | `Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)\<`In`, `Out`\>

- a `Node` object that represents the placed node.

#### Implementation of

Breadboard.output

#### Defined in

[packages/breadboard/src/board.ts:80](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/board.ts#L80)

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

Breadboard.run

#### Inherited from

[BoardRunner](BoardRunner.md).[run](BoardRunner.md#run)

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

Breadboard.runOnce

#### Inherited from

[BoardRunner](BoardRunner.md).[runOnce](BoardRunner.md#runonce)

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

#### Inherited from

[BoardRunner](BoardRunner.md).[fromBreadboardCapability](BoardRunner.md#frombreadboardcapability)

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

#### Inherited from

[BoardRunner](BoardRunner.md).[fromGraphDescriptor](BoardRunner.md#fromgraphdescriptor)

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

#### Inherited from

[BoardRunner](BoardRunner.md).[handlersFromBoard](BoardRunner.md#handlersfromboard)

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

#### Inherited from

[BoardRunner](BoardRunner.md).[load](BoardRunner.md#load)

#### Defined in

[packages/breadboard/src/runner.ts:318](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/runner.ts#L318)
