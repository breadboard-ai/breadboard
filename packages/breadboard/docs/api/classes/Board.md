[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / Board

# Class: Board

This is the heart of the Breadboard library.
Just like for hardware makers, the `Board` is the place where wiring of
a prototype happens.

To start making, create a new breadboard:

```js
const board = new Board();
```

For more information on how to use Breadboard, start with [Chapter 1: Hello, world?](https://github.com/breadboard-ai/breadboard/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the tutorial.

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
- [#parent](Board.md##parent)
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
- [import](Board.md#import)
- [include](Board.md#include)
- [input](Board.md#input)
- [invoke](Board.md#invoke)
- [lambda](Board.md#lambda)
- [mermaid](Board.md#mermaid)
- [output](Board.md#output)
- [passthrough](Board.md#passthrough)
- [reflect](Board.md#reflect)
- [run](Board.md#run)
- [runOnce](Board.md#runonce)
- [slot](Board.md#slot)
- [fromBreadboardCapability](Board.md#frombreadboardcapability)
- [fromGraphDescriptor](Board.md#fromgraphdescriptor)
- [handlersFromBoard](Board.md#handlersfromboard)
- [load](Board.md#load)

## Constructors

### constructor

• **new Board**(`metadata?`)

#### Parameters

| Name        | Type                                           | Description                                                                                                        |
| :---------- | :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `metadata?` | [`GraphMetadata`](../modules.md#graphmetadata) | optional metadata for the board. Use this parameter to provide title, description, version, and URL for the board. |

#### Inherited from

[BoardRunner](BoardRunner.md).[constructor](BoardRunner.md#constructor)

#### Defined in

[seeds/breadboard/src/runner.ts:79](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L79)

## Properties

### #acrossBoardsEdges

• `Private` **#acrossBoardsEdges**: { `edge`: [`Edge`](../modules.md#edge) ; `from`: [`Board`](Board.md) ; `to`: [`Board`](Board.md) }[] = `[]`

#### Defined in

[seeds/breadboard/src/board.ts:51](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L51)

---

### #closureStack

• `Private` **#closureStack**: [`Board`](Board.md)[] = `[]`

#### Defined in

[seeds/breadboard/src/board.ts:49](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L49)

---

### #parent

• `Private` `Optional` **#parent**: [`GraphDescriptor`](../modules.md#graphdescriptor)

The parent board, if this is board is a subgraph of a larger board.

#### Inherited from

[BoardRunner](BoardRunner.md).[#parent](BoardRunner.md##parent)

#### Defined in

[seeds/breadboard/src/runner.ts:72](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L72)

---

### #slots

• `Private` **#slots**: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) = `{}`

#### Inherited from

[BoardRunner](BoardRunner.md).[#slots](BoardRunner.md##slots)

#### Defined in

[seeds/breadboard/src/runner.ts:67](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L67)

---

### #topClosure

• `Private` **#topClosure**: `undefined` \| [`Board`](Board.md)

#### Defined in

[seeds/breadboard/src/board.ts:50](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L50)

---

### #validators

• `Private` **#validators**: [`BreadboardValidator`](../interfaces/BreadboardValidator.md)[] = `[]`

#### Inherited from

[BoardRunner](BoardRunner.md).[#validators](BoardRunner.md##validators)

#### Defined in

[seeds/breadboard/src/runner.ts:68](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L68)

---

### args

• `Optional` **args**: [`InputValues`](../modules.md#inputvalues)

#### Implementation of

Breadboard.args

#### Inherited from

[BoardRunner](BoardRunner.md).[args](BoardRunner.md#args)

#### Defined in

[seeds/breadboard/src/runner.ts:65](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L65)

---

### description

• `Optional` **description**: `string`

#### Implementation of

Breadboard.description

#### Inherited from

[BoardRunner](BoardRunner.md).[description](BoardRunner.md#description)

#### Defined in

[seeds/breadboard/src/runner.ts:59](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L59)

---

### edges

• **edges**: [`Edge`](../modules.md#edge)[] = `[]`

#### Implementation of

Breadboard.edges

#### Inherited from

[BoardRunner](BoardRunner.md).[edges](BoardRunner.md#edges)

#### Defined in

[seeds/breadboard/src/runner.ts:61](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L61)

---

### graphs

• `Optional` **graphs**: [`SubGraphs`](../modules.md#subgraphs)

#### Implementation of

Breadboard.graphs

#### Inherited from

[BoardRunner](BoardRunner.md).[graphs](BoardRunner.md#graphs)

#### Defined in

[seeds/breadboard/src/runner.ts:64](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L64)

---

### kits

• **kits**: [`Kit`](../interfaces/Kit.md)[] = `[]`

#### Implementation of

Breadboard.kits

#### Inherited from

[BoardRunner](BoardRunner.md).[kits](BoardRunner.md#kits)

#### Defined in

[seeds/breadboard/src/runner.ts:63](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L63)

---

### nodes

• **nodes**: [`NodeDescriptor`](../modules.md#nodedescriptor)[] = `[]`

#### Implementation of

Breadboard.nodes

#### Inherited from

[BoardRunner](BoardRunner.md).[nodes](BoardRunner.md#nodes)

#### Defined in

[seeds/breadboard/src/runner.ts:62](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L62)

---

### title

• `Optional` **title**: `string`

#### Implementation of

Breadboard.title

#### Inherited from

[BoardRunner](BoardRunner.md).[title](BoardRunner.md#title)

#### Defined in

[seeds/breadboard/src/runner.ts:58](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L58)

---

### url

• `Optional` **url**: `string`

#### Implementation of

Breadboard.url

#### Inherited from

[BoardRunner](BoardRunner.md).[url](BoardRunner.md#url)

#### Defined in

[seeds/breadboard/src/runner.ts:57](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L57)

---

### version

• `Optional` **version**: `string`

#### Implementation of

Breadboard.version

#### Inherited from

[BoardRunner](BoardRunner.md).[version](BoardRunner.md#version)

#### Defined in

[seeds/breadboard/src/runner.ts:60](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L60)

---

### runRemote

▪ `Static` **runRemote**: (`url`: `string`) => `AsyncGenerator`<`RemoteRunResult`, `void`, `unknown`\> = `runRemote`

#### Type declaration

▸ (`url`): `AsyncGenerator`<`RemoteRunResult`, `void`, `unknown`\>

##### Parameters

| Name  | Type     |
| :---- | :------- |
| `url` | `string` |

##### Returns

`AsyncGenerator`<`RemoteRunResult`, `void`, `unknown`\>

#### Inherited from

[BoardRunner](BoardRunner.md).[runRemote](BoardRunner.md#runremote)

#### Defined in

[seeds/breadboard/src/runner.ts:359](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L359)

## Methods

### addEdge

▸ **addEdge**(`edge`): `void`

#### Parameters

| Name   | Type                         |
| :----- | :--------------------------- |
| `edge` | [`Edge`](../modules.md#edge) |

#### Returns

`void`

#### Implementation of

Breadboard.addEdge

#### Defined in

[seeds/breadboard/src/board.ts:333](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L333)

---

### addEdgeAcrossBoards

▸ **addEdgeAcrossBoards**(`edge`, `from`, `to`): `void`

#### Parameters

| Name   | Type                         |
| :----- | :--------------------------- |
| `edge` | [`Edge`](../modules.md#edge) |
| `from` | [`Board`](Board.md)          |
| `to`   | [`Board`](Board.md)          |

#### Returns

`void`

#### Implementation of

Breadboard.addEdgeAcrossBoards

#### Defined in

[seeds/breadboard/src/board.ts:396](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L396)

---

### addKit

▸ **addKit**<`T`\>(`ctr`): `T`

Adds a new kit to the board.

Kits are collections of nodes that are bundled together for a specific
purpose. For example, the [LLM Starter Kit](https://github.com/breadboard-ai/breadboard/tree/main/seeds/llm-starter) provides a few nodes that
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

| Name | Type                                        |
| :--- | :------------------------------------------ |
| `T`  | extends [`Kit`](../interfaces/Kit.md)<`T`\> |

#### Parameters

| Name  | Type                                                      | Description          |
| :---- | :-------------------------------------------------------- | :------------------- |
| `ctr` | [`KitConstructor`](../interfaces/KitConstructor.md)<`T`\> | the kit constructor. |

#### Returns

`T`

- the kit object, which is associated with
  the board and can be used to place nodes on that board.

#### Implementation of

Breadboard.addKit

#### Defined in

[seeds/breadboard/src/board.ts:363](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L363)

---

### addNode

▸ **addNode**(`node`): `void`

#### Parameters

| Name   | Type                                             |
| :----- | :----------------------------------------------- |
| `node` | [`NodeDescriptor`](../modules.md#nodedescriptor) |

#### Returns

`void`

#### Implementation of

Breadboard.addNode

#### Defined in

[seeds/breadboard/src/board.ts:337](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L337)

---

### addValidator

▸ **addValidator**(`validator`): `void`

Add validator to the board.
Will call .addGraph() on the validator before executing a graph.

#### Parameters

| Name        | Type                                                          | Description                      |
| :---------- | :------------------------------------------------------------ | :------------------------------- |
| `validator` | [`BreadboardValidator`](../interfaces/BreadboardValidator.md) | a validator to add to the board. |

#### Returns

`void`

#### Implementation of

Breadboard.addValidator

#### Inherited from

[BoardRunner](BoardRunner.md).[addValidator](BoardRunner.md#addvalidator)

#### Defined in

[seeds/breadboard/src/runner.ts:258](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L258)

---

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

[seeds/breadboard/src/board.ts:385](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L385)

---

### import

▸ **import**<`In`, `Out`\>(`$ref`, `config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<[`InputValues`](../modules.md#inputvalues) & { `$ref?`: `string` ; `args`: [`InputValues`](../modules.md#inputvalues) ; `board?`: [`BreadboardCapability`](../modules.md#breadboardcapability) ; `graph?`: [`GraphDescriptor`](../modules.md#graphdescriptor) ; `parent`: [`NodeDescriptor`](../modules.md#nodedescriptor) ; `path?`: `string` ; `slotted?`: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) } & `In`, `Out`\>

Places an `import` node on the board.

Use this node to import other boards into the current board.
Outputs `board` as a BoardCapability, which can be passed to e.g. `invoke`.

#### Type parameters

| Name  | Type                                                                    |
| :---- | :---------------------------------------------------------------------- |
| `In`  | [`InputValues`](../modules.md#inputvalues)                              |
| `Out` | `Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name     | Type                                                               | Description                                  |
| :------- | :----------------------------------------------------------------- | :------------------------------------------- |
| `$ref`   | `string` \| [`GraphDescriptor`](../modules.md#graphdescriptor)     | the URL of the board to include, or a graph. |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node.         |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<[`InputValues`](../modules.md#inputvalues) & { `$ref?`: `string` ; `args`: [`InputValues`](../modules.md#inputvalues) ; `board?`: [`BreadboardCapability`](../modules.md#breadboardcapability) ; `graph?`: [`GraphDescriptor`](../modules.md#graphdescriptor) ; `parent`: [`NodeDescriptor`](../modules.md#nodedescriptor) ; `path?`: `string` ; `slotted?`: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) } & `In`, `Out`\>

- a `Node` object that represents the placed node.

#### Defined in

[seeds/breadboard/src/board.ts:210](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L210)

---

### include

▸ **include**<`In`, `Out`\>(`$ref`, `config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<[`InputValues`](../modules.md#inputvalues) & { `$ref?`: `string` ; `args`: [`InputValues`](../modules.md#inputvalues) ; `board?`: [`BreadboardCapability`](../modules.md#breadboardcapability) ; `graph?`: [`GraphDescriptor`](../modules.md#graphdescriptor) ; `parent`: [`NodeDescriptor`](../modules.md#nodedescriptor) ; `path?`: `string` ; `slotted?`: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) } & `In`, `Out`\>

Places an `include` node on the board.

Use this node to include other boards into the current board.

The `include` node acts as a sort of instant board-to-node converter: just
give it the URL of a serialized board, and it will pretend as if that whole
board is just one node.

See [`include` node
reference](https://github.com/breadboard-ai/breadboard/blob/main/seeds/breadboard/docs/nodes.md#include)
for more information.

#### Type parameters

| Name  | Type                                                                    |
| :---- | :---------------------------------------------------------------------- |
| `In`  | [`InputValues`](../modules.md#inputvalues)                              |
| `Out` | `Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name     | Type                                                                                                                           | Description                                                                                    |
| :------- | :----------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `$ref`   | `string` \| [`GraphDescriptor`](../modules.md#graphdescriptor) \| [`BreadboardCapability`](../modules.md#breadboardcapability) | the URL of the board to include, or a graph or a BreadboardCapability returned by e.g. lambda. |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration)                                                             | optional configuration for the node.                                                           |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<[`InputValues`](../modules.md#inputvalues) & { `$ref?`: `string` ; `args`: [`InputValues`](../modules.md#inputvalues) ; `board?`: [`BreadboardCapability`](../modules.md#breadboardcapability) ; `graph?`: [`GraphDescriptor`](../modules.md#graphdescriptor) ; `parent`: [`NodeDescriptor`](../modules.md#nodedescriptor) ; `path?`: `string` ; `slotted?`: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) } & `In`, `Out`\>

- a `Node` object that represents the placed node.

#### Implementation of

Breadboard.include

#### Defined in

[seeds/breadboard/src/board.ts:272](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L272)

---

### input

▸ **input**<`In`, `Out`\>(`config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

Places an `input` node on the board.

An `input` node is a node that asks for inputs from the user.

See [`input` node reference](https://github.com/breadboard-ai/breadboard/blob/main/seeds/breadboard/docs/nodes.md#input) for more information.

#### Type parameters

| Name  | Type                                                                    |
| :---- | :---------------------------------------------------------------------- |
| `In`  | [`InputValues`](../modules.md#inputvalues)                              |
| `Out` | `Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name     | Type                                                               | Description                          |
| :------- | :----------------------------------------------------------------- | :----------------------------------- |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

- a `Node` object that represents the placed node.

#### Implementation of

Breadboard.input

#### Defined in

[seeds/breadboard/src/board.ts:87](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L87)

---

### invoke

▸ **invoke**<`In`, `Out`\>(`config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<[`InputValues`](../modules.md#inputvalues) & { `$ref?`: `string` ; `args`: [`InputValues`](../modules.md#inputvalues) ; `board?`: [`BreadboardCapability`](../modules.md#breadboardcapability) ; `graph?`: [`GraphDescriptor`](../modules.md#graphdescriptor) ; `parent`: [`NodeDescriptor`](../modules.md#nodedescriptor) ; `path?`: `string` ; `slotted?`: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) } & `In`, `Out`\>

Places an `invoke` node on the board.

Use this node to invoke other boards into the current board.

See [`include` node
reference](https://github.com/breadboard-ai/breadboard/blob/main/seeds/breadboard/docs/nodes.md#include)
for more information.

Expects as input one of

- `path`: A board to be loaded
- `graph`: A graph (treated as JSON)
- `board`: A {BreadboardCapability}, e.g. from lambda or import

All other inputs are passed to the invoked board,
and the output are the invoked board's outputs.

#### Type parameters

| Name  | Type                                                                    |
| :---- | :---------------------------------------------------------------------- |
| `In`  | [`InputValues`](../modules.md#inputvalues)                              |
| `Out` | `Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name     | Type                                                                       | Description                          |
| :------- | :------------------------------------------------------------------------- | :----------------------------------- |
| `config` | `string` \| [`ConfigOrLambda`](../modules.md#configorlambda)<`In`, `Out`\> | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<[`InputValues`](../modules.md#inputvalues) & { `$ref?`: `string` ; `args`: [`InputValues`](../modules.md#inputvalues) ; `board?`: [`BreadboardCapability`](../modules.md#breadboardcapability) ; `graph?`: [`GraphDescriptor`](../modules.md#graphdescriptor) ; `parent`: [`NodeDescriptor`](../modules.md#nodedescriptor) ; `path?`: `string` ; `slotted?`: [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) } & `In`, `Out`\>

- a `Node` object that represents the placed node.

#### Defined in

[seeds/breadboard/src/board.ts:244](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L244)

---

### lambda

▸ **lambda**<`In`, `InL`, `OutL`\>(`boardOrFunction`, `config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `LambdaNodeOutputs`\>

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

| Name   | Type                                                                    |
| :----- | :---------------------------------------------------------------------- |
| `In`   | `In`                                                                    |
| `InL`  | `InL`                                                                   |
| `OutL` | `Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name              | Type                                                                                   | Description                                 |
| :---------------- | :------------------------------------------------------------------------------------- | :------------------------------------------ |
| `boardOrFunction` | `BreadboardRunner` \| [`LambdaFunction`](../modules.md#lambdafunction)<`InL`, `OutL`\> | A board or a function that builds the board |
| `config`          | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration)                     | optional configuration for the node.        |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `LambdaNodeOutputs`\>

- a `Node` object that represents the placed node.

#### Implementation of

Breadboard.lambda

#### Defined in

[seeds/breadboard/src/board.ts:134](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L134)

---

### mermaid

▸ **mermaid**(): `string`

Returns a [Mermaid](https://mermaid-js.github.io/mermaid/#/) representation
of the board.

This is useful for visualizing the board.

#### Returns

`string`

- a string containing the Mermaid representation of the board.

#### Defined in

[seeds/breadboard/src/board.ts:423](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L423)

---

### output

▸ **output**<`In`, `Out`\>(`config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

Places an `output` node on the board.

An `output` node is a node that provides outputs to the user.

See [`output` node reference](https://github.com/breadboard-ai/breadboard/blob/main/seeds/breadboard/docs/nodes.md#output) for more information.

#### Type parameters

| Name  | Type                                                                    |
| :---- | :---------------------------------------------------------------------- |
| `In`  | [`InputValues`](../modules.md#inputvalues)                              |
| `Out` | `Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name     | Type                                                               | Description                          |
| :------- | :----------------------------------------------------------------- | :----------------------------------- |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

- a `Node` object that represents the placed node.

#### Implementation of

Breadboard.output

#### Defined in

[seeds/breadboard/src/board.ts:104](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L104)

---

### passthrough

▸ **passthrough**<`In`, `Out`\>(`config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

Places the `passthrough` node on the board.

A `passthrough` node is a node that simply passes its inputs to
its outputs. Every computing machine needs a no-op node,
and Breadboard library is no exception.

See [`passthrough` node reference](https://github.com/breadboard-ai/breadboard/blob/main/seeds/breadboard/docs/nodes.md#passthrough) for more information.

#### Type parameters

| Name  | Type                                                                    |
| :---- | :---------------------------------------------------------------------- |
| `In`  | [`InputValues`](../modules.md#inputvalues)                              |
| `Out` | `Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name     | Type                                                               | Description                          |
| :------- | :----------------------------------------------------------------- | :----------------------------------- |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`In`, `Out`\>

- a `Node` object that represents the placed node.

#### Implementation of

Breadboard.passthrough

#### Defined in

[seeds/breadboard/src/board.ts:70](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L70)

---

### reflect

▸ **reflect**(`config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`never`, `ReflectNodeOutputs`\>

Places a `reflect` node on the board.

This node is used to reflect the board itself. It provides a JSON
representation of the board as a `graph` output property. This can be
used for studying the board's structure from inside the board.

See [`reflect` node reference](https://github.com/breadboard-ai/breadboard/blob/main/seeds/breadboard/docs/nodes.md#reflect) for more information.

#### Parameters

| Name     | Type                                                               | Description                          |
| :------- | :----------------------------------------------------------------- | :----------------------------------- |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`never`, `ReflectNodeOutputs`\>

- a `Node` object that represents the placed node.

#### Implementation of

Breadboard.reflect

#### Defined in

[seeds/breadboard/src/board.ts:302](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L302)

---

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

See [Chapter 8: Continuous runs](https://github.com/breadboard-ai/breadboard/tree/main/seeds/breadboard/docs/tutorial#chapter-8-continuous-runs) of Breadboard tutorial for an example of how to use this method.

#### Parameters

| Name      | Type                                                     | Description                                                                                                                                                                                                                                           |
| :-------- | :------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `probe?`  | `EventTarget`                                            | an optional probe. If provided, the board will dispatch events to it. See [Chapter 7: Probes](https://github.com/breadboard-ai/breadboard/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information. |
| `slots?`  | [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) | an optional map of slotted graphs. See [Chapter 6: Boards with slots](https://github.com/breadboard-ai/breadboard/tree/main/seeds/breadboard/docs/tutorial#chapter-6-boards-with-slots) of the Breadboard tutorial for more information.              |
| `result?` | [`RunResult`](RunResult.md)                              | -                                                                                                                                                                                                                                                     |

#### Returns

`AsyncGenerator`<[`RunResult`](RunResult.md), `any`, `unknown`\>

#### Implementation of

Breadboard.run

#### Inherited from

[BoardRunner](BoardRunner.md).[run](BoardRunner.md#run)

#### Defined in

[seeds/breadboard/src/runner.ts:116](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L116)

---

### runOnce

▸ **runOnce**(`inputs`, `context?`, `probe?`): `Promise`<`Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

A simplified version of `run` that runs the board until the board provides
an output, and returns that output.

This is useful for running boards that don't have multiple outputs
or the the outputs are only expected to be visited once.

#### Parameters

| Name       | Type                                                        | Description                                                                                                                                                                                                                                           |
| :--------- | :---------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inputs`   | [`InputValues`](../modules.md#inputvalues)                  | the input values to provide to the board.                                                                                                                                                                                                             |
| `context?` | [`NodeHandlerContext`](../interfaces/NodeHandlerContext.md) | -                                                                                                                                                                                                                                                     |
| `probe?`   | `EventTarget`                                               | an optional probe. If provided, the board will dispatch events to it. See [Chapter 7: Probes](https://github.com/breadboard-ai/breadboard/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information. |

#### Returns

`Promise`<`Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

- outputs provided by the board.

#### Implementation of

Breadboard.runOnce

#### Inherited from

[BoardRunner](BoardRunner.md).[runOnce](BoardRunner.md#runonce)

#### Defined in

[seeds/breadboard/src/runner.ts:218](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L218)

---

### slot

▸ **slot**<`In`, `Out`\>(`slot`, `config?`): [`BreadboardNode`](../interfaces/BreadboardNode.md)<`SlotNodeInputs` & `In`, `Out`\>

Places a `slot` node on the board.

This node is used to provide a slot for another board to be placed into.

This type of node is useful for situations where we wish to leave
a place in the board where anyone could insert other boards.

Programmers call it "dependency injection".

See [`slot` node reference](https://github.com/breadboard-ai/breadboard/blob/main/seeds/breadboard/docs/nodes.md#slot) for more information.

#### Type parameters

| Name  | Type                                                                    |
| :---- | :---------------------------------------------------------------------- |
| `In`  | [`InputValues`](../modules.md#inputvalues)                              |
| `Out` | `Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\> |

#### Parameters

| Name     | Type                                                               | Description                          |
| :------- | :----------------------------------------------------------------- | :----------------------------------- |
| `slot`   | `string`                                                           | the name of the slot.                |
| `config` | [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration) | optional configuration for the node. |

#### Returns

[`BreadboardNode`](../interfaces/BreadboardNode.md)<`SlotNodeInputs` & `In`, `Out`\>

- a `Node` object that represents the placed node.

#### Implementation of

Breadboard.slot

#### Defined in

[seeds/breadboard/src/board.ts:325](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/board.ts#L325)

---

### fromBreadboardCapability

▸ `Static` **fromBreadboardCapability**(`board`): `Promise`<[`BoardRunner`](BoardRunner.md)\>

Creates a runnable board from a BreadboardCapability,

#### Parameters

| Name    | Type                                                         | Description                                                     |
| :------ | :----------------------------------------------------------- | :-------------------------------------------------------------- |
| `board` | [`BreadboardCapability`](../modules.md#breadboardcapability) | {BreadboardCapability} A BreadboardCapability including a board |

#### Returns

`Promise`<[`BoardRunner`](BoardRunner.md)\>

A runnable board.

#### Inherited from

[BoardRunner](BoardRunner.md).[fromBreadboardCapability](BoardRunner.md#frombreadboardcapability)

#### Defined in

[seeds/breadboard/src/runner.ts:324](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L324)

---

### fromGraphDescriptor

▸ `Static` **fromGraphDescriptor**(`graph`, `kits?`): `Promise`<[`BoardRunner`](BoardRunner.md)\>

Creates a new board from JSON. If you have a serialized board, you can
use this method to turn it into into a new Board instance.

#### Parameters

| Name    | Type                                               | Description                           |
| :------ | :------------------------------------------------- | :------------------------------------ |
| `graph` | [`GraphDescriptor`](../modules.md#graphdescriptor) | the JSON representation of the board. |
| `kits?` | `KitImportMap`                                     | -                                     |

#### Returns

`Promise`<[`BoardRunner`](BoardRunner.md)\>

- a new `Board` instance.

#### Inherited from

[BoardRunner](BoardRunner.md).[fromGraphDescriptor](BoardRunner.md#fromgraphdescriptor)

#### Defined in

[seeds/breadboard/src/runner.ts:269](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L269)

---

### handlersFromBoard

▸ `Static` **handlersFromBoard**(`board`): `Promise`<[`NodeHandlers`](../modules.md#nodehandlers)<[`NodeHandlerContext`](../interfaces/NodeHandlerContext.md)\>\>

#### Parameters

| Name    | Type                            |
| :------ | :------------------------------ |
| `board` | [`BoardRunner`](BoardRunner.md) |

#### Returns

`Promise`<[`NodeHandlers`](../modules.md#nodehandlers)<[`NodeHandlerContext`](../interfaces/NodeHandlerContext.md)\>\>

#### Inherited from

[BoardRunner](BoardRunner.md).[handlersFromBoard](BoardRunner.md#handlersfromboard)

#### Defined in

[seeds/breadboard/src/runner.ts:349](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L349)

---

### load

▸ `Static` **load**(`url`, `options?`): `Promise`<[`BoardRunner`](BoardRunner.md)\>

Loads a board from a URL or a file path.

#### Parameters

| Name                  | Type                                                     | Description                          |
| :-------------------- | :------------------------------------------------------- | :----------------------------------- |
| `url`                 | `string`                                                 | the URL or a file path to the board. |
| `options?`            | `Object`                                                 | -                                    |
| `options.base?`       | `string`                                                 | -                                    |
| `options.kits?`       | `KitImportMap`                                           | -                                    |
| `options.outerGraph?` | [`GraphDescriptor`](../modules.md#graphdescriptor)       | -                                    |
| `options.slotted?`    | [`BreadboardSlotSpec`](../modules.md#breadboardslotspec) | -                                    |

#### Returns

`Promise`<[`BoardRunner`](BoardRunner.md)\>

- a new `Board` instance.

#### Inherited from

[BoardRunner](BoardRunner.md).[load](BoardRunner.md#load)

#### Defined in

[seeds/breadboard/src/runner.ts:298](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/runner.ts#L298)
