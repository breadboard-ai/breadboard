[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / BreadboardValidator

# Interface: BreadboardValidator

A validator for a breadboard.
For example to check integrity using information flow control.

## Table of contents

### Methods

- [addGraph](BreadboardValidator.md#addgraph)
- [getSubgraphValidator](BreadboardValidator.md#getsubgraphvalidator)
- [getValidatorMetadata](BreadboardValidator.md#getvalidatormetadata)

## Methods

### addGraph

▸ **addGraph**(`graph`): `void`

Add a graph and validate it.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `graph` | `GraphDescriptor` | The graph to validate. |

#### Returns

`void`

**`Throws`**

Error if the graph is invalid.

#### Defined in

[seeds/breadboard/src/types.ts:98](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/breadboard/src/types.ts#L98)

___

### getSubgraphValidator

▸ **getSubgraphValidator**(`node`, `actualInputs?`): [`BreadboardValidator`](BreadboardValidator.md)

Generate a validator for a subgraph, replacing a given node. Call
.addGraph() on the returned validator to add and validate the subgraph.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `node` | `NodeDescriptor` | The node to replace. |
| `actualInputs?` | `string`[] | Actual inputs to the node (as opposed to assuming all inputs with * or that optional ones are present) |

#### Returns

[`BreadboardValidator`](BreadboardValidator.md)

A validator for the subgraph.

#### Defined in

[seeds/breadboard/src/types.ts:116](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/breadboard/src/types.ts#L116)

___

### getValidatorMetadata

▸ **getValidatorMetadata**(`node`): [`BreadboardValidatorMetadata`](BreadboardValidatorMetadata.md)

Gets the validation metadata for a node.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `node` | `NodeDescriptor` | Node to get metadata for. |

#### Returns

[`BreadboardValidatorMetadata`](BreadboardValidatorMetadata.md)

#### Defined in

[seeds/breadboard/src/types.ts:105](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/breadboard/src/types.ts#L105)
