[@google-labs/breadboard](README.md) / Exports

# @google-labs/breadboard

## Table of contents

### Classes

- [Board](classes/Board.md)
- [BoardRunner](classes/BoardRunner.md)
- [DebugProbe](classes/DebugProbe.md)
- [LogProbe](classes/LogProbe.md)
- [Node](classes/Node.md)
- [RunResult](classes/RunResult.md)

### Interfaces

- [BreadboardNode](interfaces/BreadboardNode.md)
- [BreadboardValidator](interfaces/BreadboardValidator.md)
- [BreadboardValidatorMetadata](interfaces/BreadboardValidatorMetadata.md)
- [Kit](interfaces/Kit.md)
- [KitConstructor](interfaces/KitConstructor.md)
- [NodeFactory](interfaces/NodeFactory.md)
- [NodeHandlerContext](interfaces/NodeHandlerContext.md)

### Type Aliases

- [BreadboardCapability](modules.md#breadboardcapability)
- [BreadboardSlotSpec](modules.md#breadboardslotspec)
- [ConfigOrLambda](modules.md#configorlambda)
- [GenericKit](modules.md#generickit)
- [LambdaFunction](modules.md#lambdafunction)
- [NodeConfigurationConstructor](modules.md#nodeconfigurationconstructor)
- [OptionalIdConfiguration](modules.md#optionalidconfiguration)
- [ProbeEvent](modules.md#probeevent)
- [RunResultType](modules.md#runresulttype)

## Type Aliases

### BreadboardCapability

Ƭ **BreadboardCapability**: `Capability` & { `board`: `GraphDescriptor` ; `kind`: ``"board"``  }

#### Defined in

[seeds/breadboard/src/types.ts:222](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/types.ts#L222)

___

### BreadboardSlotSpec

Ƭ **BreadboardSlotSpec**: `Record`<`string`, `GraphDescriptor`\>

#### Defined in

[seeds/breadboard/src/types.ts:26](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/types.ts#L26)

___

### ConfigOrLambda

Ƭ **ConfigOrLambda**<`In`, `Out`\>: [`OptionalIdConfiguration`](modules.md#optionalidconfiguration) \| [`BreadboardCapability`](modules.md#breadboardcapability) \| [`BreadboardNode`](interfaces/BreadboardNode.md)<`LambdaNodeInputs`, `LambdaNodeOutputs`\> \| `GraphDescriptor` \| [`LambdaFunction`](modules.md#lambdafunction)<`In`, `Out`\> \| { `board`: [`BreadboardCapability`](modules.md#breadboardcapability) \| [`BreadboardNode`](interfaces/BreadboardNode.md)<`LambdaNodeInputs`, `LambdaNodeOutputs`\> \| [`LambdaFunction`](modules.md#lambdafunction)<`In`, `Out`\>  }

Synctactic sugar for node factories that accept lambdas. This allows passing
either
 - A JS function that is a lambda function defining the board
 - A board capability, i.e. the result of calling lambda()
 - A board node, which should be a node with a `board` output
or
 - A regular config, with a `board` property with any of the above.

use `getConfigWithLambda()` to turn this into a regular config.

#### Type parameters

| Name |
| :------ |
| `In` |
| `Out` |

#### Defined in

[seeds/breadboard/src/types.ts:319](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/types.ts#L319)

___

### GenericKit

Ƭ **GenericKit**<`T`\>: [`Kit`](interfaces/Kit.md) & { [key in T[number]]: Function }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends readonly `Key`[] |

#### Defined in

[seeds/breadboard/src/types.ts:87](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/types.ts#L87)

___

### LambdaFunction

Ƭ **LambdaFunction**<`In`, `Out`\>: (`board`: `Breadboard`, `input`: [`BreadboardNode`](interfaces/BreadboardNode.md)<`In`, `Out`\>, `output`: [`BreadboardNode`](interfaces/BreadboardNode.md)<`In`, `Out`\>) => `void`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |
| `Out` | `OutputValues` |

#### Type declaration

▸ (`board`, `input`, `output`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `board` | `Breadboard` |
| `input` | [`BreadboardNode`](interfaces/BreadboardNode.md)<`In`, `Out`\> |
| `output` | [`BreadboardNode`](interfaces/BreadboardNode.md)<`In`, `Out`\> |

##### Returns

`void`

#### Defined in

[seeds/breadboard/src/types.ts:332](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/types.ts#L332)

___

### NodeConfigurationConstructor

Ƭ **NodeConfigurationConstructor**: `Record`<`string`, `NodeValue` \| [`BreadboardNode`](interfaces/BreadboardNode.md)<`InputValues`, `OutputValues`\>\>

A node configuration that optionally has nodes as values. The Node()
constructor will remove those and turn them into wires into the node instead.

#### Defined in

[seeds/breadboard/src/types.ts:303](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/types.ts#L303)

___

### OptionalIdConfiguration

Ƭ **OptionalIdConfiguration**: { `$id?`: `string`  } & [`NodeConfigurationConstructor`](modules.md#nodeconfigurationconstructor)

A node configuration that can optionally have an `$id` property.

The `$id` property is used to identify the node in the board and is not
passed to the node itself.

#### Defined in

[seeds/breadboard/src/types.ts:295](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/types.ts#L295)

___

### ProbeEvent

Ƭ **ProbeEvent**: `CustomEvent`<`ProbeDetails`\>

A probe event that is distpached during board run.

See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) for more information.

#### Defined in

[seeds/breadboard/src/types.ts:172](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/types.ts#L172)

___

### RunResultType

Ƭ **RunResultType**: ``"input"`` \| ``"output"`` \| ``"beforehandler"``

#### Defined in

[seeds/breadboard/src/types.ts:28](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard/src/types.ts#L28)
