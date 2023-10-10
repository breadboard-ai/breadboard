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
- [outputsPromise](TraversalResult.md#outputspromise)
- [pendingOutputs](TraversalResult.md#pendingoutputs)
- [skip](TraversalResult.md#skip)
- [state](TraversalResult.md#state)

## Properties

### descriptor

• **descriptor**: [`NodeDescriptor`](../modules.md#nodedescriptor)

#### Defined in

[types.ts:220](https://github.com/google/labs-prototypes/blob/5114223/seeds/graph-runner/src/types.ts#L220)

___

### inputs

• **inputs**: [`InputValues`](../modules.md#inputvalues)

#### Defined in

[types.ts:221](https://github.com/google/labs-prototypes/blob/5114223/seeds/graph-runner/src/types.ts#L221)

___

### missingInputs

• **missingInputs**: `string`[]

#### Defined in

[types.ts:222](https://github.com/google/labs-prototypes/blob/5114223/seeds/graph-runner/src/types.ts#L222)

___

### newOpportunities

• **newOpportunities**: [`Edge`](../modules.md#edge)[]

#### Defined in

[types.ts:224](https://github.com/google/labs-prototypes/blob/5114223/seeds/graph-runner/src/types.ts#L224)

___

### opportunities

• **opportunities**: [`Edge`](../modules.md#edge)[]

#### Defined in

[types.ts:223](https://github.com/google/labs-prototypes/blob/5114223/seeds/graph-runner/src/types.ts#L223)

___

### outputsPromise

• `Optional` **outputsPromise**: `Promise`<`Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Defined in

[types.ts:226](https://github.com/google/labs-prototypes/blob/5114223/seeds/graph-runner/src/types.ts#L226)

___

### pendingOutputs

• **pendingOutputs**: `Map`<`symbol`, `Promise`<`CompletedNodeOutput`\>\>

#### Defined in

[types.ts:227](https://github.com/google/labs-prototypes/blob/5114223/seeds/graph-runner/src/types.ts#L227)

___

### skip

• **skip**: `boolean`

#### Defined in

[types.ts:228](https://github.com/google/labs-prototypes/blob/5114223/seeds/graph-runner/src/types.ts#L228)

___

### state

• **state**: `QueuedNodeValuesState`

#### Defined in

[types.ts:225](https://github.com/google/labs-prototypes/blob/5114223/seeds/graph-runner/src/types.ts#L225)
