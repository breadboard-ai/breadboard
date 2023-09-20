[@google-labs/breadboard](README.md) / Exports

# @google-labs/breadboard

## Table of contents

### Classes

- [Board](classes/Board.md)
- [DebugProbe](classes/DebugProbe.md)
- [LogProbe](classes/LogProbe.md)
- [Node](classes/Node.md)
- [RunResult](classes/RunResult.md)

### Interfaces

- [BreadboardNode](interfaces/BreadboardNode.md)
- [BreadboardValidator](interfaces/BreadboardValidator.md)
- [BreadboardValidatorMetadata](interfaces/BreadboardValidatorMetadata.md)
- [Kit](interfaces/Kit.md)
- [NodeFactory](interfaces/NodeFactory.md)

### Type Aliases

- [BreadboardSlotSpec](modules.md#breadboardslotspec)
- [OptionalIdConfiguration](modules.md#optionalidconfiguration)
- [ProbeEvent](modules.md#probeevent)
- [RunResultType](modules.md#runresulttype)

## Type Aliases

### BreadboardSlotSpec

Ƭ **BreadboardSlotSpec**: `Record`<`string`, `GraphDescriptor`\>

#### Defined in

[seeds/breadboard/src/types.ts:24](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/breadboard/src/types.ts#L24)

___

### OptionalIdConfiguration

Ƭ **OptionalIdConfiguration**: { `$id?`: `string`  } & `NodeConfiguration`

A node configuration that can optionally have an `$id` property.

The `$id` property is used to identify the node in the board and is not
passed to the node itself.

#### Defined in

[seeds/breadboard/src/types.ts:226](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/breadboard/src/types.ts#L226)

___

### ProbeEvent

Ƭ **ProbeEvent**: `CustomEvent`<`ProbeDetails`\>

A probe event that is distpached during board run.

See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) for more information.

#### Defined in

[seeds/breadboard/src/types.ts:158](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/breadboard/src/types.ts#L158)

___

### RunResultType

Ƭ **RunResultType**: ``"input"`` \| ``"output"`` \| ``"beforehandler"``

#### Defined in

[seeds/breadboard/src/types.ts:26](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/breadboard/src/types.ts#L26)
