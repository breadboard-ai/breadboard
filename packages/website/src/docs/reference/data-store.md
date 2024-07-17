---
layout: docs.liquid
title: Handling Multimodal Content Efficiently with Data Store
tags:
  - reference
  - miscellaneous
---

When handling multimodal content, we can quickly end up passing around large chunks of data between components. This is particularly true when this data is encoded as inline [base64 content](https://en.wikipedia.org/wiki/Base64), resulting in very large text strings being passed over the wires.

To handle such content more efficiently, Breadboard has a concept of a **Data Store**: a way to temporarily store large content across board runs.

Once the data is stored in the Data Store, only the handle pointing to the stored data is being passed to across the wires, which is a lot more memory-efficient.

> [!NOTE]
> Currently, Breadboard uses in-memory [blobs](https://developer.mozilla.org/en-US/docs/Web/API/Blob) to store data, but we're hoping to add more scalable and less ephemeral Data Store implementation in the future.

With Data Store in the mix, we need to be aware of whether or not the data we're passing is just a handle or a base64 string. If our component expects to consume a base64 string and gets an opaque handle instead, it will unlikely function as intended.

Some components are innately aware of the difference. For example, the [`fetch`](/breadboard/docs/kits/core/#the-fetch-component) component will automatically convert handles into base64 strings before making a request. Similarly, the [`output`](/breadboard/docs/reference/kits/built-in/#the-output-component) component knows how to display both kinds of data, and the [`input`](/breadboard/docs/reference/kits/built-in/#the-input-component) will automatically convert any base64 strings into handles.

For components that aren't aware of the distinction between the inline base64 data and the data stored in the Data Store, there are two helpers: the [`deflate`](/breadboard/docs/kits/core/#the-deflate-component) and [`inflate`](https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-inflate-component) components.

{{ "/breadboard/static/boards/kits/core-deflate.bgl.json" | board }}

The **deflate** component scans the data supplied as input, looks for any base64 content and then stores that content, converting it into a handle in data. Think of it as "deflating" the large chunk of data that's being passed as input and outputting lightweight handles.

{{ "/breadboard/static/boards/kits/core-inflate.bgl.json" | board }}

The **inflate** component does the opposite: it looks for handles and replaces them with base64 string representing the data. It "inflates" all lightweight handles it finds into a large chunk of inlined data.

To do their work, both components look for a certain shape of an object in the JSON input. If we want them to successfully inflate or deflate data, we must match the shape.

When deflating, the component is looking for this shape:

```json
{
  "inlineData": {
    "mimeType": "string of the content MIME type",
    "data": "base64-encoded data"
  }
}
```

> [!TIP]
> The shape of the inline data matches that of Gemini API's [Blob](https://ai.google.dev/api/rest/v1/Content#blob) structure.

When inflating, the component is looking for this shape:

```json
{
  "storedData": {
    "handle": "handle that Data Store knows how to recognize"
  }
}
```

When they encounter the shape they're looking for, they return back the same data, but with that shape replaced by its opposite: the `inlineData` becomes `storedData` when deflating and `storedData` becomes `inlineData` when inflating.
