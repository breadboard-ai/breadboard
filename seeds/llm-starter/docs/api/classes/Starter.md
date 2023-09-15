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

[starter.ts:67](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L67)

## Properties

### #handlers

• `Private` **#handlers**: `NodeHandlers`

#### Defined in

[starter.ts:61](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L61)

___

### #nodeFactory

• `Private` **#nodeFactory**: `NodeFactory`

#### Defined in

[starter.ts:60](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L60)

___

### url

• **url**: `string` = `"npm:@google-labs/llm-starter"`

#### Implementation of

Kit.url

#### Defined in

[starter.ts:59](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L59)

## Accessors

### handlers

• `get` **handlers**(): `NodeHandlers`

#### Returns

`NodeHandlers`

#### Implementation of

Kit.handlers

#### Defined in

[starter.ts:63](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L63)

## Methods

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

[starter.ts:72](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L72)

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

[starter.ts:107](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L107)

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

[starter.ts:130](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L130)

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

[starter.ts:115](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L115)

___

### promptTemplate

▸ **promptTemplate**<`In`\>(`template`, `config?`): `BreadboardNode`<`In` & `PromptTemplateInputs`, `PropmtTemplateOutputs`\>

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

`BreadboardNode`<`In` & `PromptTemplateInputs`, `PropmtTemplateOutputs`\>

#### Defined in

[starter.ts:79](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L79)

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

[starter.ts:99](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L99)

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

[starter.ts:137](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L137)

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

[starter.ts:91](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L91)

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

[starter.ts:123](https://github.com/Chizobaonorh/labs-prototypes/blob/6556259/seeds/llm-starter/src/starter.ts#L123)
