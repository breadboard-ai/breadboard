[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / RunnerLike

# Interface: RunnerLike

## Hierarchy

- **`RunnerLike`**

  ↳ [`BreadboardRunner`](BreadboardRunner.md)

## Table of contents

### Methods

- [run](RunnerLike.md#run)
- [runOnce](RunnerLike.md#runonce)

## Methods

### run

▸ **run**(`context?`, `result?`): `AsyncGenerator`\<[`BreadboardRunResult`](BreadboardRunResult.md), `any`, `unknown`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `context?` | [`NodeHandlerContext`](NodeHandlerContext.md) |
| `result?` | [`BreadboardRunResult`](BreadboardRunResult.md) |

#### Returns

`AsyncGenerator`\<[`BreadboardRunResult`](BreadboardRunResult.md), `any`, `unknown`\>

#### Defined in

[packages/breadboard/src/types.ts:633](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L633)

___

### runOnce

▸ **runOnce**(`inputs`, `context?`): `Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`InputValues`](../modules.md#inputvalues) |
| `context?` | [`NodeHandlerContext`](NodeHandlerContext.md) |

#### Returns

`Promise`\<`Partial`\<`Record`\<`string`, [`NodeValue`](../modules.md#nodevalue)\>\>\>

#### Defined in

[packages/breadboard/src/types.ts:637](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/types.ts#L637)
