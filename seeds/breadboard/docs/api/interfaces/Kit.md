[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / Kit

# Interface: Kit

## Hierarchy

- `KitDescriptor`

  ↳ **`Kit`**

## Table of contents

### Properties

- [url](Kit.md#url)
- [using](Kit.md#using)

### Accessors

- [handlers](Kit.md#handlers)

## Properties

### url

• **url**: `string`

The URL pointing to the location of the kit.

#### Inherited from

KitDescriptor.url

#### Defined in

seeds/graph-runner/dist/src/types.d.ts:98

___

### using

• `Optional` **using**: `string`[]

The list of node types in this kit that are used by the graph.
If left blank or omitted, all node types are assumed to be used.

#### Inherited from

KitDescriptor.using

#### Defined in

seeds/graph-runner/dist/src/types.d.ts:103

## Accessors

### handlers

• `get` **handlers**(): `NodeHandlers`

#### Returns

`NodeHandlers`

#### Defined in

[seeds/breadboard/src/types.ts:21](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/types.ts#L21)
