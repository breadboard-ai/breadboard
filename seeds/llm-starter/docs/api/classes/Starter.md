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
- [description](Starter.md#description)
- [title](Starter.md#title)
- [url](Starter.md#url)
- [version](Starter.md#version)

### Accessors

- [handlers](Starter.md#handlers)

### Methods

- [#create](Starter.md##create)
- [append](Starter.md#append)
- [embedText](Starter.md#embedtext)
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

[starter.ts:73](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L73)

## Properties

### #handlers

• `Private` **#handlers**: `NodeHandlers`

#### Defined in

[starter.ts:67](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L67)

___

### #nodeFactory

• `Private` **#nodeFactory**: `NodeFactory`

#### Defined in

[starter.ts:66](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L66)

___

### description

• **description**: `string` = `"A kit that provides a few necessary components for wiring boards that use PaLM API."`

#### Implementation of

Kit.description

#### Defined in

[starter.ts:61](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L61)

___

### title

• **title**: `string` = `"LLM Starter Kit"`

#### Implementation of

Kit.title

#### Defined in

[starter.ts:60](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L60)

___

### url

• **url**: `string` = `"npm:@google-labs/llm-starter"`

#### Implementation of

Kit.url

#### Defined in

[starter.ts:64](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L64)

___

### version

• **version**: `string` = `"0.0.1"`

#### Implementation of

Kit.version

#### Defined in

[starter.ts:63](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L63)

## Accessors

### handlers

• `get` **handlers**(): `NodeHandlers`

#### Returns

`NodeHandlers`

#### Implementation of

Kit.handlers

#### Defined in

[starter.ts:69](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L69)

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

[starter.ts:78](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L78)

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

[starter.ts:86](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L86)

___

### embedText

▸ **embedText**(`config?`): `BreadboardNode`<`EmbedTextInputs`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`EmbedTextInputs`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[starter.ts:142](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L142)

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

[starter.ts:116](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L116)

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

[starter.ts:136](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L136)

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

[starter.ts:123](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L123)

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

[starter.ts:92](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L92)

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

[starter.ts:109](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L109)

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

[starter.ts:148](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L148)

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

[starter.ts:102](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L102)

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

[starter.ts:130](https://github.com/google/labs-prototypes/blob/99919d5/seeds/llm-starter/src/starter.ts#L130)
