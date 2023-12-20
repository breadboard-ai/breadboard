[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / NodeFactory

# Interface: NodeFactory

## Table of contents

### Methods

- [create](NodeFactory.md#create)
- [getConfigWithLambda](NodeFactory.md#getconfigwithlambda)

## Methods

### create

▸ **create**\<`Inputs`, `Outputs`\>(`kit`, `type`, `configuration?`, `id?`): [`BreadboardNode`](BreadboardNode.md)\<`Inputs`, `Outputs`\>

#### Type parameters

| Name |
| :------ |
| `Inputs` |
| `Outputs` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `kit` | `undefined` \| [`Kit`](Kit.md) |
| `type` | `string` |
| `configuration?` | [`NodeConfigurationConstructor`](../modules.md#nodeconfigurationconstructor) |
| `id?` | `string` |

#### Returns

[`BreadboardNode`](BreadboardNode.md)\<`Inputs`, `Outputs`\>

#### Defined in

[packages/breadboard/src/types.ts:386](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L386)

___

### getConfigWithLambda

▸ **getConfigWithLambda**\<`Inputs`, `Outputs`\>(`config`): [`OptionalIdConfiguration`](../modules.md#optionalidconfiguration)

#### Type parameters

| Name |
| :------ |
| `Inputs` |
| `Outputs` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | [`ConfigOrLambda`](../modules.md#configorlambda)\<`Inputs`, `Outputs`\> |

#### Returns

[`OptionalIdConfiguration`](../modules.md#optionalidconfiguration)

#### Defined in

[packages/breadboard/src/types.ts:392](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L392)
