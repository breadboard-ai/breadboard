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

- `BreadboardRunner`

## Table of contents

### Constructors

- [constructor](BoardRunner.md#constructor)

### Properties

- [#parent](BoardRunner.md##parent)
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
- [run](BoardRunner.md#run)
- [runOnce](BoardRunner.md#runonce)
- [fromBreadboardCapability](BoardRunner.md#frombreadboardcapability)
- [fromGraphDescriptor](BoardRunner.md#fromgraphdescriptor)
- [handlersFromBoard](BoardRunner.md#handlersfromboard)
- [load](BoardRunner.md#load)

## Constructors

### constructor

• **new BoardRunner**(`metadata?`)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `metadata?` | [`GraphMetadata`](../modules.md#graphmetadata) | optional metadata for the board. Use this parameter to provide title, description, version, and URL for the board. |

#### Defined in

[seeds/breadboard/src/runner.ts:79](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L79)

## Properties

### #parent

• `Private` `Optional` **#parent**: [`GraphDescriptor`](../modules.md#graphdescriptor)

The parent board, if this is board is a subgraph of a larger board.

#### Defined in

[seeds/breadboard/src/runner.ts:72](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L72)

___

### #slots

• `Private` **#slots**: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) = `{}`

#### Defined in

[seeds/breadboard/src/runner.ts:67](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L67)

___

### #validators

• `Private` **#validators**: [`BreadboardValidator`](../interfaces/BreadboardValidator.md)[] = `[]`

#### Defined in

[seeds/breadboard/src/runner.ts:68](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L68)

___

### args

• `Optional` **args**: [`InputValues`](../modules.md#inputvalues)

#### Implementation of

BreadboardRunner.args

#### Defined in

[seeds/breadboard/src/runner.ts:65](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L65)

___

### description

• `Optional` **description**: `string`

#### Implementation of

BreadboardRunner.description

#### Defined in

[seeds/breadboard/src/runner.ts:59](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L59)

___

### edges

• **edges**: [`Edge`](../modules.md#edge)[] = `[]`

#### Implementation of

BreadboardRunner.edges

#### Defined in

[seeds/breadboard/src/runner.ts:61](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L61)

___

### graphs

• `Optional` **graphs**: [`SubGraphs`](../modules.md#subgraphs)

#### Implementation of

BreadboardRunner.graphs

#### Defined in

[seeds/breadboard/src/runner.ts:64](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L64)

___

### kits

• **kits**: [`Kit`](../interfaces/Kit.md)[] = `[]`

#### Implementation of

BreadboardRunner.kits

#### Defined in

[seeds/breadboard/src/runner.ts:63](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L63)

___

### nodes

• **nodes**: [`NodeDescriptor`](../modules.md#nodedescriptor)[] = `[]`

#### Implementation of

BreadboardRunner.nodes

#### Defined in

[seeds/breadboard/src/runner.ts:62](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L62)

___

### title

• `Optional` **title**: `string`

#### Implementation of

BreadboardRunner.title

#### Defined in

[seeds/breadboard/src/runner.ts:58](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L58)

___

### url

• `Optional` **url**: `string`

#### Implementation of

BreadboardRunner.url

#### Defined in

[seeds/breadboard/src/runner.ts:57](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L57)

___

### version

• `Optional` **version**: `string`

#### Implementation of

BreadboardRunner.version

#### Defined in

[seeds/breadboard/src/runner.ts:60](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L60)

___

### runRemote

▪ `Static` **runRemote**: (`url`: `string`) => `AsyncGenerator`<`RemoteRunResult`, `void`, `unknown`\> = `runRemote`

#### Type declaration

▸ (`url`): `AsyncGenerator`<`RemoteRunResult`, `void`, `unknown`\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |

##### Returns

`AsyncGenerator`<`RemoteRunResult`, `void`, `unknown`\>

#### Defined in

[seeds/breadboard/src/runner.ts:359](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L359)

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

BreadboardRunner.addValidator

#### Defined in

[seeds/breadboard/src/runner.ts:258](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L258)

___

### run

▸ **run**(`probe?`, `slots?`, `result?`): `AsyncGenerator`<[`RunResult`](RunResult.md), `any`, `unknown`\>

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

See [Chapter 8: Continuous runs](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-8-continuous-runs) of Breadboard tutorial for an example of how to use this method.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `probe?` | `EventTarget` | an optional probe. If provided, the board will dispatch events to it. See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information. |
| `slots?` | [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) | an optional map of slotted graphs. See [Chapter 6: Boards with slots](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-6-boards-with-slots) of the Breadboard tutorial for more information. |
| `result?` | [`RunResult`](RunResult.md) | - |

#### Returns

`AsyncGenerator`<[`RunResult`](RunResult.md), `any`, `unknown`\>

#### Implementation of

BreadboardRunner.run

#### Defined in

[seeds/breadboard/src/runner.ts:116](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L116)

___

### runOnce

▸ **runOnce**(`inputs`, `context?`, `probe?`): `Promise`<`Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

A simplified version of `run` that runs the board until the board provides
an output, and returns that output.

This is useful for running boards that don't have multiple outputs
or the the outputs are only expected to be visited once.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `inputs` | [`InputValues`](../modules.md#inputvalues) | the input values to provide to the board. |
| `context?` | [`NodeHandlerContext`](../interfaces/NodeHandlerContext.md) | - |
| `probe?` | `EventTarget` | an optional probe. If provided, the board will dispatch events to it. See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information. |

#### Returns

`Promise`<`Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

- outputs provided by the board.

#### Implementation of

BreadboardRunner.runOnce

#### Defined in

[seeds/breadboard/src/runner.ts:218](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L218)

___

### fromBreadboardCapability

▸ `Static` **fromBreadboardCapability**(`board`): `Promise`<[`BoardRunner`](BoardRunner.md)\>

Creates a runnable board from a BreadboardCapability,

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `board` | [`BreadboardCapability`](../modules.md#breadboardcapability) | {BreadboardCapability} A BreadboardCapability including a board |

#### Returns

`Promise`<[`BoardRunner`](BoardRunner.md)\>

A runnable board.

#### Defined in

[seeds/breadboard/src/runner.ts:324](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L324)

___

### fromGraphDescriptor

▸ `Static` **fromGraphDescriptor**(`graph`, `kits?`): `Promise`<[`BoardRunner`](BoardRunner.md)\>

Creates a new board from JSON. If you have a serialized board, you can
use this method to turn it into into a new Board instance.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `graph` | [`GraphDescriptor`](../modules.md#graphdescriptor) | the JSON representation of the board. |
| `kits?` | `KitImportMap` | - |

#### Returns

`Promise`<[`BoardRunner`](BoardRunner.md)\>

- a new `Board` instance.

#### Defined in

[seeds/breadboard/src/runner.ts:269](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L269)

___

### handlersFromBoard

▸ `Static` **handlersFromBoard**(`board`): `Promise`<[`NodeHandlers`](../modules.md#nodehandlers)<[`NodeHandlerContext`](../interfaces/NodeHandlerContext.md)\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `board` | [`BoardRunner`](BoardRunner.md) |

#### Returns

`Promise`<[`NodeHandlers`](../modules.md#nodehandlers)<[`NodeHandlerContext`](../interfaces/NodeHandlerContext.md)\>\>

#### Defined in

[seeds/breadboard/src/runner.ts:349](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L349)

___

### load

▸ `Static` **load**(`url`, `options?`): `Promise`<[`BoardRunner`](BoardRunner.md)\>

Loads a board from a URL or a file path.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `url` | `string` | the URL or a file path to the board. |
| `options?` | `Object` | - |
| `options.base?` | `string` | - |
| `options.kits?` | `KitImportMap` | - |
| `options.outerGraph?` | [`GraphDescriptor`](../modules.md#graphdescriptor) | - |
| `options.slotted?` | [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) | - |

#### Returns

`Promise`<[`BoardRunner`](BoardRunner.md)\>

- a new `Board` instance.

#### Defined in

[seeds/breadboard/src/runner.ts:298](https://github.com/google/labs-prototypes/blob/99919d5/seeds/breadboard/src/runner.ts#L298)
