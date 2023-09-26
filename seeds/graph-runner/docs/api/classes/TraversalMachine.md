[@google-labs/graph-runner](../README.md) / [Exports](../modules.md) / TraversalMachine

# Class: TraversalMachine

## Implements

- `AsyncIterable`<[`TraversalResult`](../interfaces/TraversalResult.md)\>

## Table of contents

### Constructors

- [constructor](TraversalMachine.md#constructor)

### Properties

- [graph](TraversalMachine.md#graph)
- [previousResult](TraversalMachine.md#previousresult)

### Methods

- [[asyncIterator]](TraversalMachine.md#[asynciterator])
- [start](TraversalMachine.md#start)
- [prepareToSafe](TraversalMachine.md#preparetosafe)

## Constructors

### constructor

• **new TraversalMachine**(`descriptor`, `result?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `descriptor` | [`GraphDescriptor`](../modules.md#graphdescriptor) |
| `result?` | [`TraversalResult`](../interfaces/TraversalResult.md) |

#### Defined in

[traversal/machine.ts:17](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/machine.ts#L17)

## Properties

### graph

• **graph**: `GraphRepresentation`

#### Defined in

[traversal/machine.ts:14](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/machine.ts#L14)

___

### previousResult

• `Optional` **previousResult**: [`TraversalResult`](../interfaces/TraversalResult.md)

#### Defined in

[traversal/machine.ts:15](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/machine.ts#L15)

## Methods

### [asyncIterator]

▸ **[asyncIterator]**(): `AsyncIterator`<[`TraversalResult`](../interfaces/TraversalResult.md), `any`, `undefined`\>

#### Returns

`AsyncIterator`<[`TraversalResult`](../interfaces/TraversalResult.md), `any`, `undefined`\>

#### Implementation of

AsyncIterable.[asyncIterator]

#### Defined in

[traversal/machine.ts:22](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/machine.ts#L22)

___

### start

▸ **start**(): `TraversalMachineIterator`

#### Returns

`TraversalMachineIterator`

#### Defined in

[traversal/machine.ts:26](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/machine.ts#L26)

___

### prepareToSafe

▸ `Static` **prepareToSafe**(`result`): `Promise`<[`TraversalResult`](../interfaces/TraversalResult.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `result` | [`TraversalResult`](../interfaces/TraversalResult.md) |

#### Returns

`Promise`<[`TraversalResult`](../interfaces/TraversalResult.md)\>

#### Defined in

[traversal/machine.ts:49](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/machine.ts#L49)
