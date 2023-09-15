[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / DebugProbe

# Class: DebugProbe

## Hierarchy

- `EventTarget`

  ↳ **`DebugProbe`**

## Table of contents

### Constructors

- [constructor](DebugProbe.md#constructor)

### Properties

- [#inputPins](DebugProbe.md##inputpins)
- [#nodePins](DebugProbe.md##nodepins)

### Methods

- [#getInputPins](DebugProbe.md##getinputpins)
- [#onBeforeHandler](DebugProbe.md##onbeforehandler)
- [addEventListener](DebugProbe.md#addeventlistener)
- [dispatchEvent](DebugProbe.md#dispatchevent)
- [removeEventListener](DebugProbe.md#removeeventlistener)
- [replaceNode](DebugProbe.md#replacenode)
- [watchInput](DebugProbe.md#watchinput)

## Constructors

### constructor

• **new DebugProbe**()

Creates a new DebugProbe.

A `DebugProbe` can be used to examine and modify the inputs to a node
as the board is running.

**`Example`**

```ts
const probe = new DebugProbe();
probe.addInputPin("node-id", "input-name", (value) => value + 1);

const board = new Board();
board.runOnce(probe);
```

#### Overrides

EventTarget.constructor

#### Defined in

[seeds/breadboard/src/debug.ts:39](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/debug.ts#L39)

## Properties

### #inputPins

• `Private` **#inputPins**: `Map`<`string`, `NodePins`\>

#### Defined in

[seeds/breadboard/src/debug.ts:21](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/debug.ts#L21)

___

### #nodePins

• `Private` **#nodePins**: `Map`<`string`, `DebugNodePin`\>

#### Defined in

[seeds/breadboard/src/debug.ts:22](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/debug.ts#L22)

## Methods

### #getInputPins

▸ `Private` **#getInputPins**(`nodeId`): `NodePins`

#### Parameters

| Name | Type |
| :------ | :------ |
| `nodeId` | `string` |

#### Returns

`NodePins`

#### Defined in

[seeds/breadboard/src/debug.ts:44](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/debug.ts#L44)

___

### #onBeforeHandler

▸ `Private` **#onBeforeHandler**(`event`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `event` | `Event` |

#### Returns

`void`

#### Defined in

[seeds/breadboard/src/debug.ts:83](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/debug.ts#L83)

___

### addEventListener

▸ **addEventListener**(`type`, `callback`, `options?`): `void`

Appends an event listener for events whose type attribute value is type. The callback argument sets the callback that will be invoked when the event is dispatched.

The options argument sets listener-specific options. For compatibility this can be a boolean, in which case the method behaves exactly as if the value was specified as options's capture.

When set to true, options's capture prevents callback from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE. When false (or not present), callback will not be invoked when event's eventPhase attribute value is CAPTURING_PHASE. Either way, callback will be invoked if event's eventPhase attribute value is AT_TARGET.

When set to true, options's passive indicates that the callback will not cancel the event by invoking preventDefault(). This is used to enable performance optimizations described in § 2.8 Observing event listeners.

When set to true, options's once indicates that the callback will only be invoked once after which the event listener will be removed.

If an AbortSignal is passed for options's signal, then the event listener will be removed when signal is aborted.

The event listener is appended to target's event listener list and is not appended if it has the same type, callback, and capture.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener)

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `callback` | ``null`` \| `EventListenerOrEventListenerObject` |
| `options?` | `boolean` \| `AddEventListenerOptions` |

#### Returns

`void`

#### Inherited from

EventTarget.addEventListener

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8168

___

### dispatchEvent

▸ **dispatchEvent**(`event`): `boolean`

Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)

#### Parameters

| Name | Type |
| :------ | :------ |
| `event` | `Event` |

#### Returns

`boolean`

#### Inherited from

EventTarget.dispatchEvent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8174

___

### removeEventListener

▸ **removeEventListener**(`type`, `callback`, `options?`): `void`

Removes the event listener in target's event listener list with the same type, callback, and options.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/removeEventListener)

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `callback` | ``null`` \| `EventListenerOrEventListenerObject` |
| `options?` | `boolean` \| `EventListenerOptions` |

#### Returns

`void`

#### Inherited from

EventTarget.removeEventListener

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8180

___

### replaceNode

▸ **replaceNode**(`nodeId`, `pin`): `void`

Replacing a node's handler with a custom function.

This can be useful when you want to avoid running a node's handler in
tests or other conditions. For example, replace a `generateText` node from
`llm-starter` kit with a function that returns a constant value.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `nodeId` | `string` | id of the node whose handler to replace |
| `pin` | `DebugNodePin` | the new handler function. Unlike the handler function, this one must be synchronous. |

#### Returns

`void`

#### Defined in

[seeds/breadboard/src/debug.ts:79](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/debug.ts#L79)

___

### watchInput

▸ **watchInput**(`nodeId`, `inputName`, `debugPin`): `void`

Add a debug pin to a node's input.

Debug pin is a function that will be called before the
node's handler is called. If the pin function returns a value, that value
will be used as the input value. If the pin function returns undefined,
the input value will not be modified.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `nodeId` | `string` | id of the node to add the pin to |
| `inputName` | `string` | name of the input to pin |
| `debugPin` | `DebugPin` | the pin function. It takes in the input value as its only argument and returns a new value or undefined. |

#### Returns

`void`

#### Defined in

[seeds/breadboard/src/debug.ts:64](https://github.com/Chizobaonorh/labs-prototypes/blob/c454773/seeds/breadboard/src/debug.ts#L64)
