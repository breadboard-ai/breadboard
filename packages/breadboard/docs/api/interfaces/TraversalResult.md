[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / TraversalResult

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

[packages/breadboard/src/types.ts:259](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L259)

___

### inputs

• **inputs**: [`InputValues`](../modules.md#inputvalues)

#### Defined in

[packages/breadboard/src/types.ts:260](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L260)

___

### missingInputs

• **missingInputs**: `string`[]

#### Defined in

[packages/breadboard/src/types.ts:261](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L261)

___

### newOpportunities

• **newOpportunities**: [`Edge`](../modules.md#edge)[]

#### Defined in

[packages/breadboard/src/types.ts:263](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L263)

___

### opportunities

• **opportunities**: [`Edge`](../modules.md#edge)[]

#### Defined in

[packages/breadboard/src/types.ts:262](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L262)

___

### outputsPromise

• `Optional` **outputsPromise**: `Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Defined in

[packages/breadboard/src/types.ts:265](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L265)

___

### pendingOutputs

• **pendingOutputs**: `Map`\<`symbol`, `Promise`\<[`CompletedNodeOutput`](CompletedNodeOutput.md)\>\>

#### Defined in

[packages/breadboard/src/types.ts:266](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L266)

___

### skip

• **skip**: `boolean`

#### Defined in

[packages/breadboard/src/types.ts:267](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L267)

___

### state

• **state**: [`QueuedNodeValuesState`](QueuedNodeValuesState.md)

#### Defined in

[packages/breadboard/src/types.ts:264](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/types.ts#L264)
