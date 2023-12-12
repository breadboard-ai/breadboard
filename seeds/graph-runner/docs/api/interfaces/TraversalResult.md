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

[seeds/graph-runner/src/types.ts:232](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L232)

---

### inputs

• **inputs**: [`InputValues`](../modules.md#inputvalues)

#### Defined in

[seeds/graph-runner/src/types.ts:233](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L233)

---

### missingInputs

• **missingInputs**: `string`[]

#### Defined in

[seeds/graph-runner/src/types.ts:234](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L234)

---

### newOpportunities

• **newOpportunities**: [`Edge`](../modules.md#edge)[]

#### Defined in

[seeds/graph-runner/src/types.ts:236](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L236)

---

### opportunities

• **opportunities**: [`Edge`](../modules.md#edge)[]

#### Defined in

[seeds/graph-runner/src/types.ts:235](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L235)

---

### outputsPromise

• `Optional` **outputsPromise**: `Promise`<`Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Defined in

[seeds/graph-runner/src/types.ts:238](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L238)

---

### pendingOutputs

• **pendingOutputs**: `Map`<`symbol`, `Promise`<`CompletedNodeOutput`\>\>

#### Defined in

[seeds/graph-runner/src/types.ts:239](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L239)

---

### skip

• **skip**: `boolean`

#### Defined in

[seeds/graph-runner/src/types.ts:240](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L240)

---

### state

• **state**: `QueuedNodeValuesState`

#### Defined in

[seeds/graph-runner/src/types.ts:237](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/graph-runner/src/types.ts#L237)
