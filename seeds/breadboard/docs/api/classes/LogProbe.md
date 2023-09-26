[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / LogProbe

# Class: LogProbe

A convenience probe for easily logging events from the Board.
Usage:
```ts
const log = new LogProbe();
for await (const result of this.run(log)) {
 // ...
}
```

## Hierarchy

- `EventTarget`

  ↳ **`LogProbe`**

## Table of contents

### Constructors

- [constructor](LogProbe.md#constructor)

### Properties

- [#receiver](LogProbe.md##receiver)

### Methods

- [#eventHandler](LogProbe.md##eventhandler)
- [addEventListener](LogProbe.md#addeventlistener)
- [dispatchEvent](LogProbe.md#dispatchevent)
- [removeEventListener](LogProbe.md#removeeventlistener)

## Constructors

### constructor

• **new LogProbe**(`receiver?`)

Creates a new LogProbe instance. If no receiver is provided, the
console will be used.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `receiver?` | `Receiver` | Optional. An object with a `log` method that accepts any number of arguments. |

#### Overrides

EventTarget.constructor

#### Defined in

[seeds/breadboard/src/log.ts:32](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/log.ts#L32)

## Properties

### #receiver

• `Private` **#receiver**: `Receiver`

#### Defined in

[seeds/breadboard/src/log.ts:24](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/log.ts#L24)

## Methods

### #eventHandler

▸ `Private` **#eventHandler**(`event`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `event` | `Event` |

#### Returns

`void`

#### Defined in

[seeds/breadboard/src/log.ts:42](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/breadboard/src/log.ts#L42)

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
