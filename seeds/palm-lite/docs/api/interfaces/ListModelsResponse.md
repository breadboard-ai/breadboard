[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / ListModelsResponse

# Interface: ListModelsResponse

Response from `ListModel` containing a paginated list of Models.

## Table of contents

### Properties

- [models](ListModelsResponse.md#models)
- [nextPageToken](ListModelsResponse.md#nextpagetoken)

## Properties

### models

• `Optional` **models**: [`Model`](Model.md)[]

The returned Models.

#### Defined in

[types.ts:195](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L195)

___

### nextPageToken

• `Optional` **nextPageToken**: `string`

A token, which can be sent as `page_token` to retrieve the next page. If this field is omitted, there are no more pages.

#### Defined in

[types.ts:199](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L199)
