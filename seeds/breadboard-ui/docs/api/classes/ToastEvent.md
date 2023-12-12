[@google-labs/breadboard-ui](../README.md) / [Exports](../modules.md) / ToastEvent

# Class: ToastEvent

## Hierarchy

- `Event`

  ↳ **`ToastEvent`**

## Table of contents

### Constructors

- [constructor](ToastEvent.md#constructor)

### Properties

- [AT_TARGET](ToastEvent.md#at_target)
- [BUBBLING_PHASE](ToastEvent.md#bubbling_phase)
- [CAPTURING_PHASE](ToastEvent.md#capturing_phase)
- [NONE](ToastEvent.md#none)
- [bubbles](ToastEvent.md#bubbles)
- [cancelBubble](ToastEvent.md#cancelbubble)
- [cancelable](ToastEvent.md#cancelable)
- [composed](ToastEvent.md#composed)
- [currentTarget](ToastEvent.md#currenttarget)
- [defaultPrevented](ToastEvent.md#defaultprevented)
- [eventPhase](ToastEvent.md#eventphase)
- [isTrusted](ToastEvent.md#istrusted)
- [message](ToastEvent.md#message)
- [returnValue](ToastEvent.md#returnvalue)
- [srcElement](ToastEvent.md#srcelement)
- [target](ToastEvent.md#target)
- [timeStamp](ToastEvent.md#timestamp)
- [toastType](ToastEvent.md#toasttype)
- [type](ToastEvent.md#type)
- [AT_TARGET](ToastEvent.md#at_target-1)
- [BUBBLING_PHASE](ToastEvent.md#bubbling_phase-1)
- [CAPTURING_PHASE](ToastEvent.md#capturing_phase-1)
- [NONE](ToastEvent.md#none-1)
- [eventName](ToastEvent.md#eventname)

### Methods

- [composedPath](ToastEvent.md#composedpath)
- [initEvent](ToastEvent.md#initevent)
- [preventDefault](ToastEvent.md#preventdefault)
- [stopImmediatePropagation](ToastEvent.md#stopimmediatepropagation)
- [stopPropagation](ToastEvent.md#stoppropagation)

## Constructors

### constructor

• **new ToastEvent**(`message`, `toastType`)

#### Parameters

| Name        | Type        |
| :---------- | :---------- |
| `message`   | `string`    |
| `toastType` | `ToastType` |

#### Overrides

Event.constructor

#### Defined in

[seeds/breadboard-ui/src/events.ts:28](https://github.com/breadboard-ai/breadboard/blob/a792f6c/seeds/breadboard-ui/src/events.ts#L28)

## Properties

### AT_TARGET

• `Readonly` **AT_TARGET**: `2`

#### Inherited from

Event.AT_TARGET

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8057

---

### BUBBLING_PHASE

• `Readonly` **BUBBLING_PHASE**: `3`

#### Inherited from

Event.BUBBLING_PHASE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8058

---

### CAPTURING_PHASE

• `Readonly` **CAPTURING_PHASE**: `1`

#### Inherited from

Event.CAPTURING_PHASE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8056

---

### NONE

• `Readonly` **NONE**: `0`

#### Inherited from

Event.NONE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8055

---

### bubbles

• `Readonly` **bubbles**: `boolean`

Returns true or false depending on how event was initialized. True if event goes through its target's ancestors in reverse tree order, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/bubbles)

#### Inherited from

Event.bubbles

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7952

---

### cancelBubble

• **cancelBubble**: `boolean`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelBubble)

#### Inherited from

Event.cancelBubble

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7958

---

### cancelable

• `Readonly` **cancelable**: `boolean`

Returns true or false depending on how event was initialized. Its return value does not always carry meaning, but true can indicate that part of the operation during which event was dispatched, can be canceled by invoking the preventDefault() method.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelable)

#### Inherited from

Event.cancelable

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7964

---

### composed

• `Readonly` **composed**: `boolean`

Returns true or false depending on how event was initialized. True if event invokes listeners past a ShadowRoot node that is the root of its target, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composed)

#### Inherited from

Event.composed

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7970

---

### currentTarget

• `Readonly` **currentTarget**: `null` \| `EventTarget`

Returns the object whose event listener's callback is currently being invoked.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/currentTarget)

#### Inherited from

Event.currentTarget

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7976

---

### defaultPrevented

• `Readonly` **defaultPrevented**: `boolean`

Returns true if preventDefault() was invoked successfully to indicate cancelation, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/defaultPrevented)

#### Inherited from

Event.defaultPrevented

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7982

---

### eventPhase

• `Readonly` **eventPhase**: `number`

Returns the event's phase, which is one of NONE, CAPTURING_PHASE, AT_TARGET, and BUBBLING_PHASE.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/eventPhase)

#### Inherited from

Event.eventPhase

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7988

---

### isTrusted

• `Readonly` **isTrusted**: `boolean`

Returns true if event was dispatched by the user agent, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/isTrusted)

#### Inherited from

Event.isTrusted

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7994

---

### message

• **message**: `string`

#### Defined in

[seeds/breadboard-ui/src/events.ts:28](https://github.com/breadboard-ai/breadboard/blob/a792f6c/seeds/breadboard-ui/src/events.ts#L28)

---

### returnValue

• **returnValue**: `boolean`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/returnValue)

#### Inherited from

Event.returnValue

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8000

---

### srcElement

• `Readonly` **srcElement**: `null` \| `EventTarget`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/srcElement)

#### Inherited from

Event.srcElement

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8006

---

### target

• `Readonly` **target**: `null` \| `EventTarget`

Returns the object to which event is dispatched (its target).

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/target)

#### Inherited from

Event.target

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8012

---

### timeStamp

• `Readonly` **timeStamp**: `number`

Returns the event's timestamp as the number of milliseconds measured relative to the time origin.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/timeStamp)

#### Inherited from

Event.timeStamp

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8018

---

### toastType

• **toastType**: `ToastType`

#### Defined in

[seeds/breadboard-ui/src/events.ts:28](https://github.com/breadboard-ai/breadboard/blob/a792f6c/seeds/breadboard-ui/src/events.ts#L28)

---

### type

• `Readonly` **type**: `string`

Returns the type of event, e.g. "click", "hashchange", or "submit".

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/type)

#### Inherited from

Event.type

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8024

---

### AT_TARGET

▪ `Static` `Readonly` **AT_TARGET**: `2`

#### Inherited from

Event.AT_TARGET

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8066

---

### BUBBLING_PHASE

▪ `Static` `Readonly` **BUBBLING_PHASE**: `3`

#### Inherited from

Event.BUBBLING_PHASE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8067

---

### CAPTURING_PHASE

▪ `Static` `Readonly` **CAPTURING_PHASE**: `1`

#### Inherited from

Event.CAPTURING_PHASE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8065

---

### NONE

▪ `Static` `Readonly` **NONE**: `0`

#### Inherited from

Event.NONE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8064

---

### eventName

▪ `Static` **eventName**: `string` = `"breadboardtoastevent"`

#### Defined in

[seeds/breadboard-ui/src/events.ts:26](https://github.com/breadboard-ai/breadboard/blob/a792f6c/seeds/breadboard-ui/src/events.ts#L26)

## Methods

### composedPath

▸ **composedPath**(): `EventTarget`[]

Returns the invocation target objects of event's path (objects on which listeners will be invoked), except for any nodes in shadow trees of which the shadow root's mode is "closed" that are not reachable from event's currentTarget.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composedPath)

#### Returns

`EventTarget`[]

#### Inherited from

Event.composedPath

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8030

---

### initEvent

▸ **initEvent**(`type`, `bubbles?`, `cancelable?`): `void`

#### Parameters

| Name          | Type      |
| :------------ | :-------- |
| `type`        | `string`  |
| `bubbles?`    | `boolean` |
| `cancelable?` | `boolean` |

#### Returns

`void`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/initEvent)

#### Inherited from

Event.initEvent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8036

---

### preventDefault

▸ **preventDefault**(): `void`

If invoked when the cancelable attribute value is true, and while executing a listener for the event with passive set to false, signals to the operation that caused event to be dispatched that it needs to be canceled.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/preventDefault)

#### Returns

`void`

#### Inherited from

Event.preventDefault

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8042

---

### stopImmediatePropagation

▸ **stopImmediatePropagation**(): `void`

Invoking this method prevents event from reaching any registered event listeners after the current one finishes running and, when dispatched in a tree, also prevents event from reaching any other objects.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopImmediatePropagation)

#### Returns

`void`

#### Inherited from

Event.stopImmediatePropagation

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8048

---

### stopPropagation

▸ **stopPropagation**(): `void`

When dispatched in a tree, invoking this method prevents event from reaching any objects other than the current object.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopPropagation)

#### Returns

`void`

#### Inherited from

Event.stopPropagation

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8054
