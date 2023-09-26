[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / CountMessageTokensRequest

# Interface: CountMessageTokensRequest

Counts the number of tokens in the `prompt` sent to a model. Models may tokenize text differently, so each model may return a different `token_count`.

## Table of contents

### Properties

- [prompt](CountMessageTokensRequest.md#prompt)

## Properties

### prompt

• `Optional` **prompt**: [`MessagePrompt`](MessagePrompt.md)

Required. The prompt, whose token count is to be returned.

#### Defined in

[types.ts:51](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L51)
