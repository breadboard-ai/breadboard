---
layout: docs.njk
title: Breadboard Service Endpoint Protocol
tags:
  - reference
  - miscellaneous
---

Used by the [`service`](/breadboard/docs/kits/core/#the-service-node) node to communicate with external services.

The protocol expects two paths: `./invoke` and `./describe`, both using the `POST` method.

As the names imply, the `./invoke` path invokes service, and the `./describe` path describes it.

## The `describe` path

As `POST` body request, the service should expect a JSON object whose keys are the names of currently configured input ports, or an empty object if no input ports are currently configured.

The service should respond with a JSON object that contains two keys: `inputSchema` and `outputSchema`.

The values of these keys should be a [JSON schema](https://json-schema.org/) describing the input (or output) ports of the service.

Here is an example of a valid response:

```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "title": "Query",
        "description": "The query to supply to Google News. If empty, tops news stories will be returned.",
        "type": "string",
        "default": ""
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "result": {
        "title": "News",
        "type": "object"
      }
    }
  }
}
```

## The `invoke` path

As `POST` body request, the service should expect a JSON object whose keys are the names of the described input ports. The values of those keys are the JSON representations of the values of those ports.

For instance, for the schema above, a valid request would be:

```json
{
  "query": "Breadboards"
}
```

The service should respond with a JSON object of a similar structure: the keys of this object should be the names of the described output ports.

Given the schema above, a valid response would be:

```json
{
  "result": {
    "date": {
      "date": "Fri, 05 Jul 2024 00:37:04 GMT",
      "items": [
        {
          "title": "U.K. Labour Party wins landslide election over Conservatives: exit poll"
        }
        // ... more items elided.
      ]
    }
  }
}
```

You can see a sample implementation of the protocol at [Google News Service](https://www.val.town/v/dglazkov/googlenews) on [Valtown](https://val.town).

> [!TIP]
>
> [Valtown](https://val.town) is a quick and easy to create HTTP endpoints for Breadboard services.
