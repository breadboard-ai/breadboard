[@google-labs/graph-runner](../README.md) / [Exports](../modules.md) / TraversalResult

# Interface: TraversalResult

## Implemented by

- [`MachineResult`](../classes/MachineResult.md)

## Table of contents

### Properties

- [descriptor](TraversalResult.md#descriptor)
- [inputs](TraversalResult.md#inputs)
- [missingInputs](TraversalResult.md#missinginputs)
- [newOpportunities](TraversalResult.md#newopportunities)
- [opportunities](TraversalResult.md#opportunities)
- [outputs](TraversalResult.md#outputs)
- [skip](TraversalResult.md#skip)
- [state](TraversalResult.md#state)

## Properties

### descriptor

• **descriptor**: [`NodeDescriptor`](../modules.md#nodedescriptor)

#### Defined in

[types.ts:202](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/graph-runner/src/types.ts#L202)

___

### inputs

• **inputs**: [`InputValues`](../modules.md#inputvalues)

#### Defined in

[types.ts:203](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/graph-runner/src/types.ts#L203)

___

### missingInputs

• **missingInputs**: `string`[]

#### Defined in

[types.ts:204](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/graph-runner/src/types.ts#L204)

___

### newOpportunities

• **newOpportunities**: [`Edge`](../modules.md#edge)[]

#### Defined in

[types.ts:206](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/graph-runner/src/types.ts#L206)

___

### opportunities

• **opportunities**: [`Edge`](../modules.md#edge)[]

#### Defined in

[types.ts:205](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/graph-runner/src/types.ts#L205)

___

### outputs

• `Optional` **outputs**: `Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>

#### Defined in

[types.ts:208](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/graph-runner/src/types.ts#L208)

___

### skip

• **skip**: `boolean`

#### Defined in

[types.ts:209](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/graph-runner/src/types.ts#L209)

___

### state

• **state**: `EdgeState`

#### Defined in

[types.ts:207](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/graph-runner/src/types.ts#L207)
