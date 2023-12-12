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

| Name    | Type                                               | Description            |
| :------ | :------------------------------------------------- | :--------------------- |
| `graph` | [`GraphDescriptor`](../modules.md#graphdescriptor) | The graph to validate. |

#### Returns

`void`

**`Throws`**

Error if the graph is invalid.

#### Defined in

[seeds/breadboard/src/types.ts:407](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/types.ts#L407)

---

### getSubgraphValidator

▸ **getSubgraphValidator**(`node`, `actualInputs?`): [`BreadboardValidator`](BreadboardValidator.md)

Generate a validator for a subgraph, replacing a given node. Call
.addGraph() on the returned validator to add and validate the subgraph.

#### Parameters

| Name            | Type                                             | Description                                                                                             |
| :-------------- | :----------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| `node`          | [`NodeDescriptor`](../modules.md#nodedescriptor) | The node to replace.                                                                                    |
| `actualInputs?` | `string`[]                                       | Actual inputs to the node (as opposed to assuming all inputs with \* or that optional ones are present) |

#### Returns

[`BreadboardValidator`](BreadboardValidator.md)

A validator for the subgraph.

#### Defined in

[seeds/breadboard/src/types.ts:425](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/types.ts#L425)

---

### getValidatorMetadata

▸ **getValidatorMetadata**(`node`): [`BreadboardValidatorMetadata`](BreadboardValidatorMetadata.md)

Gets the validation metadata for a node.

#### Parameters

| Name   | Type                                             | Description               |
| :----- | :----------------------------------------------- | :------------------------ |
| `node` | [`NodeDescriptor`](../modules.md#nodedescriptor) | Node to get metadata for. |

#### Returns

[`BreadboardValidatorMetadata`](BreadboardValidatorMetadata.md)

#### Defined in

[seeds/breadboard/src/types.ts:414](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/types.ts#L414)
