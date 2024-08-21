[@google-labs/node-nursery](README.md) / Exports

# @google-labs/node-nursery

## Table of contents

### References

- [default](modules.md#default)

### Type Aliases

- [Nursery](modules.md#nursery)

### Variables

- [Nursery](modules.md#nursery-1)

## References

### default

Renames and re-exports [Nursery](modules.md#nursery-1)

## Type Aliases

### Nursery

Ƭ **Nursery**: `InstanceType`\<typeof [`Nursery`](modules.md#nursery-1)\>

#### Defined in

[index.ts:8](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/node-nursery/src/index.ts#L8)

[index.ts:10](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/node-nursery/src/index.ts#L10)

## Variables

### Nursery

• `Const` **Nursery**: `KitConstructor`\<`GenericKit`\<\{ `addToVectorDatabase`: (`inputs`: `InputValues`) => `Promise`\<\{ `db`: `VectorDatabase` = db }\> ; `cache`: (`inputs`: `InputValues`) => `Promise`\<`Partial`\<`Record`\<`string`, `NodeValue`\>\>\> ; `chunker`: (`inputs`: `InputValues`) => `Promise`\<`ChunkerOutputs`\> ; `createVectorDatabase`: (`inputs`: `InputValues`) => `Promise`\<`Partial`\<`Record`\<`string`, `NodeValue`\>\>\> ; `embedDocs`: (`inputs`: `InputValues`) => `Promise`\<`Partial`\<`Record`\<`string`, `NodeValue`\>\>\> ; `embedString`: (`inputs`: `InputValues`) => `Promise`\<`Partial`\<`Record`\<`string`, `NodeValue`\>\>\> ; `queryVectorDatabase`: (`inputs`: `InputValues`) => `Promise`\<`Partial`\<`Record`\<`string`, `NodeValue`\>\>\> ; `templateParser`: (`inputs`: `InputValues`) => `Promise`\<`Partial`\<`Record`\<`string`, `NodeValue`\>\>\> ; `textAsset`: (`inputs`: `InputValues`) => `Promise`\<\{ `text`: `string` = f }\> ; `textAssetsFromPath`: (`inputs`: `InputValues`) => `Promise`\<\{ `documents`: \{ `id`: `string` = filename; `text`: `string` = contents }[]  }\>  }\>\>

#### Defined in

[nursery.ts:20](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/node-nursery/src/nursery.ts#L20)
