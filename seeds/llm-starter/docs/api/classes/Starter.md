[@google-labs/llm-starter](../README.md) / [Exports](../modules.md) / Starter

# Class: Starter

Syntactic sugar around the `coreHandlers` library.

## Implements

- `Kit`

## Table of contents

### Constructors

- [constructor](Starter.md#constructor)

### Properties

- [#handlers](Starter.md##handlers)
- [#nodeFactory](Starter.md##nodefactory)
- [url](Starter.md#url)

### Accessors

- [handlers](Starter.md#handlers)

### Methods

- [#create](Starter.md##create)
- [append](Starter.md#append)
- [fetch](Starter.md#fetch)
- [generateText](Starter.md#generatetext)
- [jsonata](Starter.md#jsonata)
- [promptTemplate](Starter.md#prompttemplate)
- [runJavascript](Starter.md#runjavascript)
- [secrets](Starter.md#secrets)
- [urlTemplate](Starter.md#urltemplate)
- [xmlToJson](Starter.md#xmltojson)

## Constructors

### constructor

• **new Starter**(`nodeFactory`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `nodeFactory` | `NodeFactory` |

#### Defined in

[starter.ts:68](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L68)

## Properties

### #handlers

• `Private` **#handlers**: `NodeHandlers`

#### Defined in

[starter.ts:62](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L62)

___

### #nodeFactory

• `Private` **#nodeFactory**: `NodeFactory`

#### Defined in

[starter.ts:61](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L61)

___

### url

• **url**: `string` = `"npm:@google-labs/llm-starter"`

#### Implementation of

Kit.url

#### Defined in

[starter.ts:60](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L60)

## Accessors

### handlers

• `get` **handlers**(): `NodeHandlers`

#### Returns

`NodeHandlers`

#### Implementation of

Kit.handlers

#### Defined in

[starter.ts:64](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L64)

## Methods

### #create

▸ `Private` **#create**<`Inputs`, `Outputs`\>(`type`, `config`): `BreadboardNode`<`Inputs`, `Outputs`\>

#### Type parameters

| Name |
| :------ |
| `Inputs` |
| `Outputs` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`Inputs`, `Outputs`\>

#### Defined in

[starter.ts:73](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L73)

___

### append

▸ **append**<`In`\>(`config?`): `BreadboardNode`<`In`, `AppendOutputs`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `AppendInputs` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`In`, `AppendOutputs`\>

#### Defined in

[starter.ts:81](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L81)

___

### fetch

▸ **fetch**(`raw?`, `config?`): `BreadboardNode`<`FetchInputs`, `FetchOutputs`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `raw?` | `boolean` |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`FetchInputs`, `FetchOutputs`\>

#### Defined in

[starter.ts:111](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L111)

___

### generateText

▸ **generateText**(`config?`): `BreadboardNode`<`GenerateTextInputs`, `GenerateTextOutputs`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`GenerateTextInputs`, `GenerateTextOutputs`\>

#### Defined in

[starter.ts:131](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L131)

___

### jsonata

▸ **jsonata**<`Out`\>(`expression`, `config?`): `BreadboardNode`<`JsonataInputs`, `Out` & `Record`<`string`, `unknown`\> & { `result`: `unknown`  }\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Out` | `Partial`<`Record`<`string`, `NodeValue`\>\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `expression` | `string` |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`JsonataInputs`, `Out` & `Record`<`string`, `unknown`\> & { `result`: `unknown`  }\>

#### Defined in

[starter.ts:118](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L118)

___

### promptTemplate

▸ **promptTemplate**<`In`\>(`template?`, `config?`): `BreadboardNode`<`In` & `PromptTemplateInputs`, `PropmtTemplateOutputs`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `template?` | `string` |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`In` & `PromptTemplateInputs`, `PropmtTemplateOutputs`\>

#### Defined in

[starter.ts:87](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L87)

___

### runJavascript

▸ **runJavascript**<`In`, `Out`\>(`name`, `config?`): `BreadboardNode`<`In` & `InputValues` & { `code?`: `string` ; `name?`: `string` ; `raw?`: `boolean`  }, `Out`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |
| `Out` | `RunJavascriptOutputs` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`In` & `InputValues` & { `code?`: `string` ; `name?`: `string` ; `raw?`: `boolean`  }, `Out`\>

#### Defined in

[starter.ts:104](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L104)

___

### secrets

▸ **secrets**<`Out`\>(`keys`, `config?`): `BreadboardNode`<`SecretInputs`, `Out`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Out` | `Partial`<`Record`<`string`, `NodeValue`\>\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `keys` | `string`[] |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`SecretInputs`, `Out`\>

#### Defined in

[starter.ts:137](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L137)

___

### urlTemplate

▸ **urlTemplate**<`In`\>(`template`, `config?`): `BreadboardNode`<`In` & `UrlTemplateInputs`, `UrlTemplateOutputs`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `template` | `string` |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`In` & `UrlTemplateInputs`, `UrlTemplateOutputs`\>

#### Defined in

[starter.ts:97](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L97)

___

### xmlToJson

▸ **xmlToJson**(`config?`): `BreadboardNode`<`XmlToJsonInputs`, `XmlToJsonOutputs`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`XmlToJsonInputs`, `XmlToJsonOutputs`\>

#### Defined in

[starter.ts:125](https://github.com/google/labs-prototypes/blob/5114223/seeds/llm-starter/src/starter.ts#L125)
