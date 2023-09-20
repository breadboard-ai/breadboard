[@google-labs/graph-integrity](../README.md) / [Exports](../modules.md) / GraphIntegrityValidator

# Class: GraphIntegrityValidator

**`Implements`**

and validates the integrity of a graph in
terms of safety.

Use one instance per id namespace. Call

**`Method`**

addGraph to add nodes to the
validator. And call

**`Method`**

getSubgraphValidator to get a new validator for
new namespaces, such as include and slot nodes

Acts as bridge between Breadboard and the generic graph validation code.

## Implements

- `BreadboardValidator`

## Table of contents

### Constructors

- [constructor](GraphIntegrityValidator.md#constructor)

### Properties

- [idMap](GraphIntegrityValidator.md#idmap)
- [parentInputs](GraphIntegrityValidator.md#parentinputs)
- [parentNode](GraphIntegrityValidator.md#parentnode)
- [policy](GraphIntegrityValidator.md#policy)
- [wholeGraph](GraphIntegrityValidator.md#wholegraph)

### Methods

- [addGraph](GraphIntegrityValidator.md#addgraph)
- [addPolicy](GraphIntegrityValidator.md#addpolicy)
- [getNodeById](GraphIntegrityValidator.md#getnodebyid)
- [getSubgraphValidator](GraphIntegrityValidator.md#getsubgraphvalidator)
- [getValidatorMetadata](GraphIntegrityValidator.md#getvalidatormetadata)
- [insertGraph](GraphIntegrityValidator.md#insertgraph)
- [toMermaid](GraphIntegrityValidator.md#tomermaid)

## Constructors

### constructor

• **new GraphIntegrityValidator**(`parentValidator?`, `parentNode?`, `parentInputs?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `parentValidator?` | [`GraphIntegrityValidator`](GraphIntegrityValidator.md) |
| `parentNode?` | `NodeFromBreadboard` |
| `parentInputs?` | `string`[] |

#### Defined in

[validator.ts:80](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L80)

## Properties

### idMap

• `Protected` **idMap**: `IdMap`

#### Defined in

[validator.ts:75](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L75)

___

### parentInputs

• `Protected` **parentInputs**: `undefined` \| `string`[]

#### Defined in

[validator.ts:77](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L77)

___

### parentNode

• `Protected` **parentNode**: `undefined` \| `NodeFromBreadboard`

#### Defined in

[validator.ts:76](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L76)

___

### policy

• `Protected` **policy**: [`GraphIntegrityPolicy`](../modules.md#graphintegritypolicy)

#### Defined in

[validator.ts:78](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L78)

___

### wholeGraph

• `Protected` **wholeGraph**: `GraphFromBreadboard`

#### Defined in

[validator.ts:74](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L74)

## Methods

### addGraph

▸ **addGraph**(`newGraph`): `void`

Add nodes to the validator and validate the full graph.

#### Parameters

| Name | Type |
| :------ | :------ |
| `newGraph` | `GraphDescriptor` |

#### Returns

`void`

**`Throws`**

if the graph is not safe.

#### Implementation of

BreadboardValidator.addGraph

#### Defined in

[validator.ts:111](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L111)

___

### addPolicy

▸ **addPolicy**(`policy`): `void`

Add a policy to validate graphs against.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `policy` | [`GraphIntegrityPolicy`](../modules.md#graphintegritypolicy) | The policy to validate against. |

#### Returns

`void`

#### Defined in

[validator.ts:101](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L101)

___

### getNodeById

▸ `Protected` **getNodeById**(`node`): `undefined` \| `NodeFromBreadboard`

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | `NodeDescriptor` |

#### Returns

`undefined` \| `NodeFromBreadboard`

#### Defined in

[validator.ts:153](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L153)

___

### getSubgraphValidator

▸ **getSubgraphValidator**(`node`, `actualInputs?`): `BreadboardValidator`

Generate a validator for a subgraph, replacing a given node. Call
.addGraph() on the returned validator to add and validate the subgraph.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `node` | `NodeDescriptor` | The node to replace. |
| `actualInputs?` | `string`[] | Actual inputs to the node (as opposed to assuming all inputs with * or that optional ones are present) |

#### Returns

`BreadboardValidator`

A validator for the subgraph.

#### Implementation of

BreadboardValidator.getSubgraphValidator

#### Defined in

[validator.ts:143](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L143)

___

### getValidatorMetadata

▸ **getValidatorMetadata**(`node`): `GraphIntegrityValidatorMetadata`

Get the safety label of a node.

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | `NodeDescriptor` |

#### Returns

`GraphIntegrityValidatorMetadata`

The safety label of the node, or undefined if it wasn't computed.
         Note that the safety label's value can be undefined, meaning that
         there were no constraints on it.

#### Implementation of

BreadboardValidator.getValidatorMetadata

#### Defined in

[validator.ts:125](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L125)

___

### insertGraph

▸ `Protected` **insertGraph**(`newGraph`): `void`

Insert a new graph into this graph.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `newGraph` | `GraphDescriptor` | Graph to be inserted |

#### Returns

`void`

#### Defined in

[validator.ts:165](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L165)

___

### toMermaid

▸ **toMermaid**(): `string`

#### Returns

`string`

#### Defined in

[validator.ts:320](https://github.com/Chizobaonorh/labs-prototypes/blob/102f6f2/seeds/graph-integrity/src/validator.ts#L320)
