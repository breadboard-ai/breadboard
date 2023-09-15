[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / Board

# Class: Board

This is the heart of the Breadboard library.
Just like for hardware makers, the `Board` is the place where wiring of
a prototype happens.

To start making, create a new breadboard:

```js
const board = new Board();
```

For more information on how to use Breadboard, start with [Chapter 1: Hello, world?](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the tutorial.

## Implements

- `Breadboard`

## Table of contents

### Constructors

- [constructor](Board.md#constructor)

### Properties

- [#localKit](Board.md##localkit)
- [#slots](Board.md##slots)
- [#validators](Board.md##validators)
- [description](Board.md#description)
- [edges](Board.md#edges)
- [kits](Board.md#kits)
- [nodes](Board.md#nodes)
- [title](Board.md#title)
- [url](Board.md#url)
- [version](Board.md#version)
- [runRemote](Board.md#runremote)

### Methods

- [addEdge](Board.md#addedge)
- [addKit](Board.md#addkit)
- [addNode](Board.md#addnode)
- [addValidator](Board.md#addvalidator)
- [include](Board.md#include)
- [input](Board.md#input)
- [mermaid](Board.md#mermaid)
- [node](Board.md#node)
- [output](Board.md#output)
- [passthrough](Board.md#passthrough)
- [reflect](Board.md#reflect)
- [run](Board.md#run)
- [runOnce](Board.md#runonce)
- [slot](Board.md#slot)
- [fromGraphDescriptor](Board.md#fromgraphdescriptor)
- [load](Board.md#load)

## Constructors

### constructor

• **new Board**(`metadata?`)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `metadata?` | `GraphMetadata` | optional metadata for the board. Use this parameter to provide title, description, version, and URL for the board. |

#### Defined in

[seeds/breadboard/src/board.ts:101](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L101)

## Properties

### #localKit

• `Private` `Optional` **#localKit**: `LocalKit`

#### Defined in

[seeds/breadboard/src/board.ts:92](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L92)

___

### #slots

• `Private` **#slots**: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) = `{}`

#### Defined in

[seeds/breadboard/src/board.ts:93](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L93)

___

### #validators

• `Private` **#validators**: [`BreadboardValidator`](../interfaces/BreadboardValidator.md)[] = `[]`

#### Defined in

[seeds/breadboard/src/board.ts:94](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L94)

___

### description

• `Optional` **description**: `string`

#### Implementation of

Breadboard.description

#### Defined in

[seeds/breadboard/src/board.ts:87](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L87)

___

### edges

• **edges**: `Edge`[] = `[]`

#### Implementation of

Breadboard.edges

#### Defined in

[seeds/breadboard/src/board.ts:89](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L89)

___

### kits

• **kits**: [`Kit`](../interfaces/Kit.md)[] = `[]`

#### Implementation of

Breadboard.kits

#### Defined in

[seeds/breadboard/src/board.ts:91](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L91)

___

### nodes

• **nodes**: `NodeDescriptor`[] = `[]`

#### Implementation of

Breadboard.nodes

#### Defined in

[seeds/breadboard/src/board.ts:90](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L90)

___

### title

• `Optional` **title**: `string`

#### Implementation of

Breadboard.title

#### Defined in

[seeds/breadboard/src/board.ts:86](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L86)

___

### url

• `Optional` **url**: `string`

#### Implementation of

Breadboard.url

#### Defined in

[seeds/breadboard/src/board.ts:85](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L85)

___

### version

• `Optional` **version**: `string`

#### Implementation of

Breadboard.version

#### Defined in

[seeds/breadboard/src/board.ts:88](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L88)

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

[seeds/breadboard/src/board.ts:528](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L528)

## Methods

### addEdge

▸ **addEdge**(`edge`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `edge` | `Edge` |

#### Returns

`void`

#### Implementation of

Breadboard.addEdge

#### Defined in

[seeds/breadboard/src/board.ts:441](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L441)

___

### addKit

▸ **addKit**<`T`\>(`ctr`): `T`

Adds a new kit to the board.

Kits are collections of nodes that are bundled together for a specific
purpose. For example, the [LLM Starter Kit](https://github.com/google/labs-prototypes/tree/main/seeds/llm-starter) provides a few nodes that
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
| `T` | extends [`Kit`](../interfaces/Kit.md)<`T`\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `ctr` | `KitConstructor`<`T`\> | the kit constructor. |

#### Returns

`T`

- the kit object, which is associated with
the board and can be used to place nodes on that board.

#### Implementation of

Breadboard.addKit

#### Defined in

[seeds/breadboard/src/board.ts:471](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L471)

___

### addNode

▸ **addNode**(`node`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | `NodeDescriptor` |

#### Returns

`void`

#### Implementation of

Breadboard.addNode

#### Defined in

[seeds/breadboard/src/board.ts:445](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L445)

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

#### Defined in

[seeds/breadboard/src/board.ts:267](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L267)

___

### include

▸ **include**<`In`, `Out`\>(`$ref`, `config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`InputValues` & { `$ref?`: `string` ; `args`: `InputValues` ; `graph?`: `GraphDescriptor` ; `parent`: `NodeDescriptor` ; `path?`: `string` ; `slotted?`: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec)  } & `In`, `Out`\>

Places an `include` node on the board.

Use this node to include other boards into the current board.

The `include` node acts as a sort of instant board-to-node converter:
just give it the URL of a serialized board, and it will pretend as if
that whole board is just one node.

See [`include` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#include) for more information.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |
| `Out` | `Partial`<`Record`<`string`, `NodeValue`\>\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `$ref` | `string` \| `GraphDescriptor` | the URL of the board to include. |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`InputValues` & { `$ref?`: `string` ; `args`: `InputValues` ; `graph?`: `GraphDescriptor` ; `parent`: `NodeDescriptor` ; `path?`: `string` ; `slotted?`: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec)  } & `In`, `Out`\>

- a `Node` object that represents the placed node.

#### Defined in

[seeds/breadboard/src/board.ts:344](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L344)

___

### input

▸ **input**<`In`, `Out`\>(`config?`): [`Node`](Node.md)<`In`, `Out`\>

Places an `input` node on the board.

An `input` node is a node that asks for inputs from the user.

See [`input` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#input) for more information.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |
| `Out` | `Partial`<`Record`<`string`, `NodeValue`\>\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`Node`](Node.md)<`In`, `Out`\>

- a `Node` object that represents the placed node.

#### Defined in

[seeds/breadboard/src/board.ts:305](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L305)

___

### mermaid

▸ **mermaid**(): `string`

Returns a [Mermaid](https://mermaid-js.github.io/mermaid/#/) representation
of the board.

This is useful for visualizing the board.

#### Returns

`string`

- a string containing the Mermaid representation of the board.

#### Defined in

[seeds/breadboard/src/board.ts:489](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L489)

___

### node

▸ **node**<`In`, `Out`\>(`handler`, `config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

This method is a work in progress. Once finished, it will allow
placing a `node` node on the board.

This node can be used to add your own JS functions to the board.
If you can't find the node in a kit that suits your needs, this might
be a good fit.

Downside: it makes your board non-portable. The serialized JSON of the
board will **not** contain the code of the function, which means that
your friends and colleagues won't be able to re-use it.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |
| `Out` | `Partial`<`Record`<`string`, `NodeValue`\>\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `handler` | `NodeHandler` | the function that will be called when the node is visited. It must take an object with input values and return an object with output values. The function can be sync or async. For example: ```js const board = new Board(); board .input() .wire( "say->", board .node(({ say }) => ({ say: `I said: ${say}` })) .wire("say->", board.output()) ); ``` |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

- a `Node` object that represents the placed node.

#### Defined in

[seeds/breadboard/src/board.ts:427](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L427)

___

### output

▸ **output**<`In`, `Out`\>(`config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

Places an `output` node on the board.

An `output` node is a node that provides outputs to the user.

See [`output` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#output) for more information.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |
| `Out` | `Partial`<`Record`<`string`, `NodeValue`\>\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

- a `Node` object that represents the placed node.

#### Defined in

[seeds/breadboard/src/board.ts:322](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L322)

___

### passthrough

▸ **passthrough**<`In`, `Out`\>(`config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

Places the `passthrough` node on the board.

A `passthrough` node is a node that simply passes its inputs to
its outputs. Every computing machine needs a no-op node,
and Breadboard library is no exception.

See [`passthrough` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#passthrough) for more information.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |
| `Out` | `Partial`<`Record`<`string`, `NodeValue`\>\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

- a `Node` object that represents the placed node.

#### Defined in

[seeds/breadboard/src/board.ts:288](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L288)

___

### reflect

▸ **reflect**(`config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`never`, `ReflectNodeOutputs`\>

Places a `reflect` node on the board.

This node is used to reflect the board itself. It provides a JSON
representation of the board as a `graph` output property. This can be
used for studying the board's structure from inside the board.

See [`reflect` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#reflect) for more information.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`never`, `ReflectNodeOutputs`\>

- a `Node` object that represents the placed node.

#### Defined in

[seeds/breadboard/src/board.ts:367](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L367)

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

#### Defined in

[seeds/breadboard/src/board.ts:138](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L138)

___

### runOnce

▸ **runOnce**(`inputs`, `probe?`, `slots?`): `Promise`<`Partial`<`Record`<`string`, `NodeValue`\>\>\>

A simplified version of `run` that runs the board until the board provides
an output, and returns that output.

This is useful for running boards that don't have multiple outputs
or the the outputs are only expected to be visited once.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `inputs` | `InputValues` | the input values to provide to the board. |
| `probe?` | `EventTarget` | an optional probe. If provided, the board will dispatch events to it. See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information. |
| `slots?` | [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) | an optional map of slotted graphs. See [Chapter 6: Boards with slots](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-6-boards-with-slots) of the Breadboard tutorial for more information. |

#### Returns

`Promise`<`Partial`<`Record`<`string`, `NodeValue`\>\>\>

- outputs provided by the board.

#### Defined in

[seeds/breadboard/src/board.ts:243](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L243)

___

### slot

▸ **slot**<`In`, `Out`\>(`slot`, `config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`SlotNodeInputs` & `In`, `Out`\>

Places a `slot` node on the board.

This node is used to provide a slot for another board to be placed into.

This type of node is useful for situations where we wish to leave
a place in the board where anyone could insert other boards.

Programmers call it "dependency injection".

See [`slot` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#slot) for more information.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |
| `Out` | `Partial`<`Record`<`string`, `NodeValue`\>\> |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `slot` | `string` | the name of the slot. |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`SlotNodeInputs` & `In`, `Out`\>

- a `Node` object that represents the placed node.

#### Defined in

[seeds/breadboard/src/board.ts:390](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L390)

___

### fromGraphDescriptor

▸ `Static` **fromGraphDescriptor**(`graph`): `Promise`<[`Board`](Board.md)\>

Creates a new board from JSON. If you have a serialized board, you can
use this method to turn it into into a new Board instance.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `graph` | `GraphDescriptor` | the JSON representation of the board. |

#### Returns

`Promise`<[`Board`](Board.md)\>

- a new `Board` instance.

#### Defined in

[seeds/breadboard/src/board.ts:500](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L500)

___

### load

▸ `Static` **load**(`url`, `options?`): `Promise`<[`Board`](Board.md)\>

Loads a board from a URL or a file path.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `url` | `string` | the URL or a file path to the board. |
| `options?` | `Object` | - |
| `options.base?` | `string` | - |
| `options.slotted?` | [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) | - |

#### Returns

`Promise`<[`Board`](Board.md)\>

- a new `Board` instance.

#### Defined in

[seeds/breadboard/src/board.ts:516](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/board.ts#L516)
