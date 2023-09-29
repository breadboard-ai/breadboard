@google-labs/breadboard-web

# @google-labs/breadboard-web

## Table of contents

### Type Aliases

- [BeforehandlerMessage](README.md#beforehandlermessage)
- [ControllerMessage](README.md#controllermessage)
- [ControllerMessageBase](README.md#controllermessagebase)
- [ControllerMessageType](README.md#controllermessagetype)
- [EndMessage](README.md#endmessage)
- [ErrorMessage](README.md#errormessage)
- [InputRequestMessage](README.md#inputrequestmessage)
- [InputResponseMessage](README.md#inputresponsemessage)
- [OutputMessage](README.md#outputmessage)
- [ProxyRequestMessage](README.md#proxyrequestmessage)
- [ProxyResponseMessage](README.md#proxyresponsemessage)
- [RoundTrip](README.md#roundtrip)
- [RoundTripControllerMessage](README.md#roundtripcontrollermessage)
- [StartMesssage](README.md#startmesssage)

### Variables

- [VALID\_MESSAGE\_TYPES](README.md#valid_message_types)

## Type Aliases

### BeforehandlerMessage

Ƭ **BeforehandlerMessage**: [`ControllerMessageBase`](README.md#controllermessagebase)<``"beforehandler"``, { `node`: `NodeDescriptor`  }\>

#### Defined in

[protocol.ts:94](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L94)

___

### ControllerMessage

Ƭ **ControllerMessage**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `data` | `unknown` | The data payload of the message. |
| `id?` | `string` | The id of the message. |
| `type` | [`ControllerMessageType`](README.md#controllermessagetype) | The type of the message. |

#### Defined in

[protocol.ts:42](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L42)

___

### ControllerMessageBase

Ƭ **ControllerMessageBase**<`Type`, `Payload`, `HasId`\>: `HasId` & { `data`: `Payload` ; `type`: \`${Type}\`  }

The message format used to communicate between the worker and its host.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Type` | extends [`ControllerMessageType`](README.md#controllermessagetype) |
| `Payload` | `Payload` |
| `HasId` | extends [`RoundTrip`](README.md#roundtrip) \| `unknown` = `unknown` |

#### Defined in

[protocol.ts:62](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L62)

___

### ControllerMessageType

Ƭ **ControllerMessageType**: typeof [`VALID_MESSAGE_TYPES`](README.md#valid_message_types)[`number`]

#### Defined in

[protocol.ts:33](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L33)

___

### EndMessage

Ƭ **EndMessage**: [`ControllerMessageBase`](README.md#controllermessagebase)<``"end"``, `unknown`\>

#### Defined in

[protocol.ts:116](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L116)

___

### ErrorMessage

Ƭ **ErrorMessage**: [`ControllerMessageBase`](README.md#controllermessagebase)<``"error"``, { `error`: `string`  }\>

#### Defined in

[protocol.ts:118](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L118)

___

### InputRequestMessage

Ƭ **InputRequestMessage**: [`ControllerMessageBase`](README.md#controllermessagebase)<``"input"``, { `inputArguments`: `NodeValue` ; `node`: `NodeDescriptor`  }, [`RoundTrip`](README.md#roundtrip)\>

#### Defined in

[protocol.ts:82](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L82)

___

### InputResponseMessage

Ƭ **InputResponseMessage**: [`ControllerMessageBase`](README.md#controllermessagebase)<``"input"``, `NodeValue`, [`RoundTrip`](README.md#roundtrip)\>

#### Defined in

[protocol.ts:88](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L88)

___

### OutputMessage

Ƭ **OutputMessage**: [`ControllerMessageBase`](README.md#controllermessagebase)<``"output"``, { `node`: `NodeDescriptor` ; `outputs`: `OutputValues`  }\>

#### Defined in

[protocol.ts:99](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L99)

___

### ProxyRequestMessage

Ƭ **ProxyRequestMessage**: [`ControllerMessageBase`](README.md#controllermessagebase)<``"proxy"``, { `inputs`: `InputValues` ; `node`: `NodeDescriptor`  }, [`RoundTrip`](README.md#roundtrip)\>

#### Defined in

[protocol.ts:104](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L104)

___

### ProxyResponseMessage

Ƭ **ProxyResponseMessage**: [`ControllerMessageBase`](README.md#controllermessagebase)<``"proxy"``, `OutputValues`, [`RoundTrip`](README.md#roundtrip)\>

#### Defined in

[protocol.ts:110](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L110)

___

### RoundTrip

Ƭ **RoundTrip**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `id` | `string` | The id of the message. |

#### Defined in

[protocol.ts:35](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L35)

___

### RoundTripControllerMessage

Ƭ **RoundTripControllerMessage**: [`ControllerMessage`](README.md#controllermessage) & [`RoundTrip`](README.md#roundtrip)

#### Defined in

[protocol.ts:57](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L57)

___

### StartMesssage

Ƭ **StartMesssage**: [`ControllerMessageBase`](README.md#controllermessagebase)<``"start"``, { `proxyNodes`: `string`[] ; `url`: `string`  }\>

#### Defined in

[protocol.ts:74](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L74)

## Variables

### VALID\_MESSAGE\_TYPES

• `Const` **VALID\_MESSAGE\_TYPES**: readonly [``"start"``, ``"input"``, ``"output"``, ``"beforehandler"``, ``"proxy"``, ``"end"``, ``"error"``]

The valid message types.

#### Defined in

[protocol.ts:23](https://github.com/google/labs-prototypes/blob/6370328/seeds/breadboard-web/src/protocol.ts#L23)
