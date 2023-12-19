[@google-labs/llm-starter](README.md) / Exports

# @google-labs/llm-starter

## Table of contents

### References

- [default](modules.md#default)

### Type Aliases

- [Starter](modules.md#starter)

### Variables

- [Starter](modules.md#starter-1)
- [starter](modules.md#starter-2)

## References

### default

Renames and re-exports [Starter](modules.md#starter-1)

## Type Aliases

### Starter

Ƭ **Starter**: `InstanceType`\<typeof [`Starter`](modules.md#starter-1)\>

#### Defined in

[index.ts:25](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/llm-starter/src/index.ts#L25)

[index.ts:35](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/llm-starter/src/index.ts#L35)

## Variables

### Starter

• `Const` **Starter**: `KitConstructor`\<`GenericKit`\<\{ `fetch`: \{ `describe`: `NodeDescriberFunction` = fetchDescriber; `invoke`: (`inputs`: `InputValues`) => `Promise`\<\{ `$error`: `any` ; `response`: `undefined` ; `stream?`: `undefined`  } \| \{ `$error?`: `undefined` ; `response`: `undefined` ; `stream`: `StreamCapability`\<`any`\>  } \| \{ `$error?`: `undefined` ; `response`: `any` ; `stream?`: `undefined`  }\>  } ; `jsonata`: \{ `describe`: `NodeDescriberFunction` = jsonataDescriber; `invoke`: `NodeHandlerFunction` = jsonataHandler } ; `promptTemplate`: \{ `describe`: `NodeDescriberFunction` = promptTemplateDescriber; `invoke`: `NodeHandlerFunction` = promptTemplateHandler } ; `runJavascript`: \{ `describe`: `NodeDescriberFunction` = runJavascriptDescriber; `invoke`: `NodeHandlerFunction` = runJavascriptHandler } ; `secrets`: \{ `describe`: `NodeDescriberFunction` = secretsDescriber; `invoke`: (`inputs`: `InputValues`) => `Promise`\<`Partial`\<`Record`\<`string`, `NodeValue`\>\>\>  } ; `urlTemplate`: \{ `describe`: `NodeDescriberFunction` = urlTemplateDescriber; `invoke`: `NodeHandlerFunction` = urlTemplateHandler } ; `xmlToJson`: \{ `describe`: () => `Promise`\<\{ `inputSchema`: \{ `properties`: \{ `xml`: \{ `description`: `string` = "Valid XML as a string"; `title`: `string` = "XML" }  }  } ; `outputSchema`: \{ `properties`: \{ `json`: \{ `description`: `string` = "JSON representation of the input XML. Represented as alt-json, described in https://developers.google.com/gdata/docs/json"; `title`: `string` = "JSON" }  }  }  }\> ; `invoke`: (`inputs`: `InputValues`) => `Promise`\<`Partial`\<`Record`\<`string`, `NodeValue`\>\>\>  }  }\>\>

#### Defined in

[index.ts:25](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/llm-starter/src/index.ts#L25)

[index.ts:35](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/llm-starter/src/index.ts#L35)

___

### starter

• `Const` **starter**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `fetch` | `NodeFactory`\<\{ `url`: `string`  }, \{ `response`: `string`  }\> |
| `jsonata` | `NodeFactory`\<\{ `[key: string]`: `NodeValue`; `expression`: `string` ; `json`: `string` ; `raw`: `boolean`  }, \{ `[key: string]`: `NodeValue`; `result`: `string`  }\> |
| `promptTemplate` | `NodeFactory`\<\{ `[key: string]`: `NodeValue`; `template`: `string`  }, \{ `prompt`: `string`  }\> |
| `runJavascript` | `NodeFactory`\<\{ `[key: string]`: `NodeValue`; `code`: `string` ; `name`: `string` ; `raw`: `boolean`  }, \{ `[k: string]`: `unknown`; `result`: `unknown`  }\> |
| `secrets` | `NodeFactory`\<\{ `keys`: `string`[]  }, \{ `[k: string]`: `string`;  }\> |
| `urlTemplate` | `NodeFactory`\<\{ `[key: string]`: `NodeValue`; `template`: `string`  }, \{ `url`: `string`  }\> |

#### Defined in

[index.ts:51](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/llm-starter/src/index.ts#L51)
