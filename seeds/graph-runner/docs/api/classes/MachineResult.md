[@google-labs/graph-runner](../README.md) / [Exports](../modules.md) / MachineResult

# Class: MachineResult

## Implements

- [`TraversalResult`](../interfaces/TraversalResult.md)

## Table of contents

### Constructors

- [constructor](MachineResult.md#constructor)

### Properties

- [descriptor](MachineResult.md#descriptor)
- [inputs](MachineResult.md#inputs)
- [missingInputs](MachineResult.md#missinginputs)
- [newOpportunities](MachineResult.md#newopportunities)
- [opportunities](MachineResult.md#opportunities)
- [outputsPromise](MachineResult.md#outputspromise)
- [pendingOutputs](MachineResult.md#pendingoutputs)
- [state](MachineResult.md#state)

### Accessors

- [skip](MachineResult.md#skip)

### Methods

- [fromObject](MachineResult.md#fromobject)

## Constructors

### constructor

• **new MachineResult**(`descriptor`, `inputs`, `missingInputs`, `opportunities`, `newOpportunities`, `state`, `pendingOutputs`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `descriptor` | [`NodeDescriptor`](../modules.md#nodedescriptor) |
| `inputs` | [`InputValues`](../modules.md#inputvalues) |
| `missingInputs` | `string`[] |
| `opportunities` | [`Edge`](../modules.md#edge)[] |
| `newOpportunities` | [`Edge`](../modules.md#edge)[] |
| `state` | `QueuedNodeValuesState` |
| `pendingOutputs` | `Map`<`symbol`, `Promise`<`CompletedNodeOutput`\>\> |

#### Defined in

[traversal/result.ts:28](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L28)

## Properties

### descriptor

• **descriptor**: [`NodeDescriptor`](../modules.md#nodedescriptor)

#### Implementation of

[TraversalResult](../interfaces/TraversalResult.md).[descriptor](../interfaces/TraversalResult.md#descriptor)

#### Defined in

[traversal/result.ts:19](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L19)

___

### inputs

• **inputs**: [`InputValues`](../modules.md#inputvalues)

#### Implementation of

[TraversalResult](../interfaces/TraversalResult.md).[inputs](../interfaces/TraversalResult.md#inputs)

#### Defined in

[traversal/result.ts:20](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L20)

___

### missingInputs

• **missingInputs**: `string`[]

#### Implementation of

[TraversalResult](../interfaces/TraversalResult.md).[missingInputs](../interfaces/TraversalResult.md#missinginputs)

#### Defined in

[traversal/result.ts:21](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L21)

___

### newOpportunities

• **newOpportunities**: [`Edge`](../modules.md#edge)[]

#### Implementation of

[TraversalResult](../interfaces/TraversalResult.md).[newOpportunities](../interfaces/TraversalResult.md#newopportunities)

#### Defined in

[traversal/result.ts:23](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L23)

___

### opportunities

• **opportunities**: [`Edge`](../modules.md#edge)[]

#### Implementation of

[TraversalResult](../interfaces/TraversalResult.md).[opportunities](../interfaces/TraversalResult.md#opportunities)

#### Defined in

[traversal/result.ts:22](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L22)

___

### outputsPromise

• `Optional` **outputsPromise**: `Promise`<`Partial`<`Record`<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Implementation of

[TraversalResult](../interfaces/TraversalResult.md).[outputsPromise](../interfaces/TraversalResult.md#outputspromise)

#### Defined in

[traversal/result.ts:25](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L25)

___

### pendingOutputs

• **pendingOutputs**: `Map`<`symbol`, `Promise`<`CompletedNodeOutput`\>\>

#### Implementation of

[TraversalResult](../interfaces/TraversalResult.md).[pendingOutputs](../interfaces/TraversalResult.md#pendingoutputs)

#### Defined in

[traversal/result.ts:26](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L26)

___

### state

• **state**: `QueuedNodeValuesState`

#### Implementation of

[TraversalResult](../interfaces/TraversalResult.md).[state](../interfaces/TraversalResult.md#state)

#### Defined in

[traversal/result.ts:24](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L24)

## Accessors

### skip

• `get` **skip**(): `boolean`

`true` if the machine decided that the node should be skipped, rather than
visited.

#### Returns

`boolean`

#### Implementation of

[TraversalResult](../interfaces/TraversalResult.md).[skip](../interfaces/TraversalResult.md#skip)

#### Defined in

[traversal/result.ts:50](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L50)

## Methods

### fromObject

▸ `Static` **fromObject**(`o`): [`MachineResult`](MachineResult.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `o` | [`TraversalResult`](../interfaces/TraversalResult.md) |

#### Returns

[`MachineResult`](MachineResult.md)

#### Defined in

[traversal/result.ts:54](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-runner/src/traversal/result.ts#L54)
