[@google-labs/breadboard-ui](../README.md) / [Exports](../modules.md) / ToastEvent

# Class: ToastEvent

## Hierarchy

- `Event`

  ↳ **`ToastEvent`**

## Table of contents

### Constructors

- [constructor](ToastEvent.md#constructor)

### Properties

- [AT\_TARGET](ToastEvent.md#at_target)
- [BUBBLING\_PHASE](ToastEvent.md#bubbling_phase)
- [CAPTURING\_PHASE](ToastEvent.md#capturing_phase)
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
- [AT\_TARGET](ToastEvent.md#at_target-1)
- [BUBBLING\_PHASE](ToastEvent.md#bubbling_phase-1)
- [CAPTURING\_PHASE](ToastEvent.md#capturing_phase-1)
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

• **new ToastEvent**(`message`, `toastType`): [`ToastEvent`](ToastEvent.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` |
| `toastType` | `ToastType` |

#### Returns

[`ToastEvent`](ToastEvent.md)

#### Overrides

Event.constructor

#### Defined in

[packages/breadboard-ui/src/events.ts:28](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/events.ts#L28)

## Properties

### AT\_TARGET

• `Readonly` **AT\_TARGET**: ``2``

#### Inherited from

Event.AT\_TARGET

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8100

___

### BUBBLING\_PHASE

• `Readonly` **BUBBLING\_PHASE**: ``3``

#### Inherited from

Event.BUBBLING\_PHASE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8101

___

### CAPTURING\_PHASE

• `Readonly` **CAPTURING\_PHASE**: ``1``

#### Inherited from

Event.CAPTURING\_PHASE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8099

___

### NONE

• `Readonly` **NONE**: ``0``

#### Inherited from

Event.NONE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8098

___

### bubbles

• `Readonly` **bubbles**: `boolean`

Returns true or false depending on how event was initialized. True if event goes through its target's ancestors in reverse tree order, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/bubbles)

#### Inherited from

Event.bubbles

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7995

___

### cancelBubble

• **cancelBubble**: `boolean`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelBubble)

#### Inherited from

Event.cancelBubble

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8001

___

### cancelable

• `Readonly` **cancelable**: `boolean`

Returns true or false depending on how event was initialized. Its return value does not always carry meaning, but true can indicate that part of the operation during which event was dispatched, can be canceled by invoking the preventDefault() method.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelable)

#### Inherited from

Event.cancelable

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8007

___

### composed

• `Readonly` **composed**: `boolean`

Returns true or false depending on how event was initialized. True if event invokes listeners past a ShadowRoot node that is the root of its target, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composed)

#### Inherited from

Event.composed

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8013

___

### currentTarget

• `Readonly` **currentTarget**: ``null`` \| `EventTarget`

Returns the object whose event listener's callback is currently being invoked.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/currentTarget)

#### Inherited from

Event.currentTarget

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8019

___

### defaultPrevented

• `Readonly` **defaultPrevented**: `boolean`

Returns true if preventDefault() was invoked successfully to indicate cancelation, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/defaultPrevented)

#### Inherited from

Event.defaultPrevented

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8025

___

### eventPhase

• `Readonly` **eventPhase**: `number`

Returns the event's phase, which is one of NONE, CAPTURING_PHASE, AT_TARGET, and BUBBLING_PHASE.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/eventPhase)

#### Inherited from

Event.eventPhase

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8031

___

### isTrusted

• `Readonly` **isTrusted**: `boolean`

Returns true if event was dispatched by the user agent, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/isTrusted)

#### Inherited from

Event.isTrusted

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8037

___

### message

• **message**: `string`

#### Defined in

[packages/breadboard-ui/src/events.ts:28](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/events.ts#L28)

___

### returnValue

• **returnValue**: `boolean`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/returnValue)

#### Inherited from

Event.returnValue

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8043

___

### srcElement

• `Readonly` **srcElement**: ``null`` \| `EventTarget`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/srcElement)

#### Inherited from

Event.srcElement

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8049

___

### target

• `Readonly` **target**: ``null`` \| `EventTarget`

Returns the object to which event is dispatched (its target).

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/target)

#### Inherited from

Event.target

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8055

___

### timeStamp

• `Readonly` **timeStamp**: `number`

Returns the event's timestamp as the number of milliseconds measured relative to the time origin.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/timeStamp)

#### Inherited from

Event.timeStamp

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8061

___

### toastType

• **toastType**: `ToastType`

#### Defined in

[packages/breadboard-ui/src/events.ts:28](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/events.ts#L28)

___

### type

• `Readonly` **type**: `string`

Returns the type of event, e.g. "click", "hashchange", or "submit".

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/type)

#### Inherited from

Event.type

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8067

___

### AT\_TARGET

▪ `Static` `Readonly` **AT\_TARGET**: ``2``

#### Inherited from

Event.AT\_TARGET

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8109

___

### BUBBLING\_PHASE

▪ `Static` `Readonly` **BUBBLING\_PHASE**: ``3``

#### Inherited from

Event.BUBBLING\_PHASE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8110

___

### CAPTURING\_PHASE

▪ `Static` `Readonly` **CAPTURING\_PHASE**: ``1``

#### Inherited from

Event.CAPTURING\_PHASE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8108

___

### NONE

▪ `Static` `Readonly` **NONE**: ``0``

#### Inherited from

Event.NONE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8107

___

### eventName

▪ `Static` **eventName**: `string` = `"breadboardtoastevent"`

#### Defined in

[packages/breadboard-ui/src/events.ts:26](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/events.ts#L26)

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

node_modules/typescript/lib/lib.dom.d.ts:8073

___

### initEvent

▸ **initEvent**(`type`, `bubbles?`, `cancelable?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `bubbles?` | `boolean` |
| `cancelable?` | `boolean` |

#### Returns

`void`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/initEvent)

#### Inherited from

Event.initEvent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8079

___

### preventDefault

▸ **preventDefault**(): `void`

If invoked when the cancelable attribute value is true, and while executing a listener for the event with passive set to false, signals to the operation that caused event to be dispatched that it needs to be canceled.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/preventDefault)

#### Returns

`void`

#### Inherited from

Event.preventDefault

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8085

___

### stopImmediatePropagation

▸ **stopImmediatePropagation**(): `void`

Invoking this method prevents event from reaching any registered event listeners after the current one finishes running and, when dispatched in a tree, also prevents event from reaching any other objects.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopImmediatePropagation)

#### Returns

`void`

#### Inherited from

Event.stopImmediatePropagation

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8091

___

### stopPropagation

▸ **stopPropagation**(): `void`

When dispatched in a tree, invoking this method prevents event from reaching any objects other than the current object.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopPropagation)

#### Returns

`void`

#### Inherited from

Event.stopPropagation

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8097
