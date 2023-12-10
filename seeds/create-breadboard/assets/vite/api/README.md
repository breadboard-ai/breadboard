@google-labs/breadboard-web

# @google-labs/breadboard-web

## Type Aliases

### LoadRequestMessage

Ƭ **LoadRequestMessage**: `Object`

The message that is sent by the host to the worker to request
loading the board.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `id` | `string` | id of the message. |
| `type` | ``"load"`` | The "load" type signals to the worker that it should load the board. |
| `data` | { `url`: `string` ; `proxyNodes`: `string`[]  } | - |
| `data.url` | `string` | The url of the board to load. |
| `data.proxyNodes` | `string`[] | The list of nodes to proxy. |

#### Defined in

[protocol.ts:52](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L52)

___

### LoadResponseMessage

Ƭ **LoadResponseMessage**: `Object`

The message that is sent by the worker to the host after it loaded the board.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `id` | `string` | The id of the message. |
| `type` | ``"load"`` | The "load" type signals to the host that the worker is responding to a load request. |
| `data` | { `title?`: `string` ; `description?`: `string` ; `version?`: `string`  } | - |
| `data.title?` | `string` | The title of the graph. |
| `data.description?` | `string` | The description of the graph. |
| `data.version?` | `string` | Version of the graph. [semver](https://semver.org/) format is encouraged. |

#### Defined in

[protocol.ts:76](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L76)

___

### StartMesssage

Ƭ **StartMesssage**: `Object`

The message that sent by the host to the worker to start the board.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | ``"start"`` | The "start" type signals to the worker that it should start the board. |
| `data` | `unknown` | - |

#### Defined in

[protocol.ts:106](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L106)

___

### InputRequestMessage

Ƭ **InputRequestMessage**: `Object`

The message that is sent by the worker to the host when the board
requests input.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `id` | `string` | The id of the message. |
| `type` | ``"input"`` | The "input" type signals to the host that the board is requesting input. |
| `data` | { `node`: `NodeDescriptor` ; `inputArguments`: `InputValues`  } | - |
| `data.node` | `NodeDescriptor` | The description of the node that is requesting input. **`See`** [NodeDescriptor](https://github.com/google/labs-prototypes/blob/main/seeds/graph-runner/src/types.ts#L54) |
| `data.inputArguments` | `InputValues` | The input arguments that were given to the node that is requesting input. These arguments typically contain the schema of the inputs that are expected. **`See`** [InputValues](https://github.com/google/labs-prototypes/blob/main/seeds/graph-runner/src/types.ts#L229) |

#### Defined in

[protocol.ts:118](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L118)

___

### InputResponseMessage

Ƭ **InputResponseMessage**: `Object`

The message that is sent by the host to the worker after it requested input.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `id` | `string` | The id of the message. |
| `type` | ``"input"`` | The "input" type signals to the worker that the host is responding to an input request. |
| `data` | `NodeValue` | The input values that the host is providing to the worker. **`See`** [NodeValue](https://github.com/google/labs-prototypes/blob/main/seeds/graph-runner/src/types.ts#L21) |

#### Defined in

[protocol.ts:146](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L146)

___

### BeforehandlerMessage

Ƭ **BeforehandlerMessage**: `Object`

The message that is sent by the worker to the host before it runs a node.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | ``"beforehandler"`` | The "beforehandler" type signals to the host that the board is about to run a node. |
| `data` | { `node`: `NodeDescriptor`  } | - |
| `data.node` | `NodeDescriptor` | The description of the node that is about to be run. **`See`** [NodeDescriptor](https://github.com/google/labs-prototypes/blob/main/seeds/graph-runner/src/types.ts#L54) |

#### Defined in

[protocol.ts:166](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L166)

___

### OutputMessage

Ƭ **OutputMessage**: `Object`

The message that is sent by the worker to the host when the board is
providing outputs.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | ``"output"`` | The "output" type signals to the host that the board is providing outputs. |
| `data` | { `node`: `NodeDescriptor` ; `outputs`: `OutputValues`  } | - |
| `data.node` | `NodeDescriptor` | The description of the node that is providing output. **`See`** [NodeDescriptor](https://github.com/google/labs-prototypes/blob/main/seeds/graph-runner/src/types.ts#L54) |
| `data.outputs` | `OutputValues` | The output values that the node is providing. **`See`** [OutputValues](https://github.com/google/labs-prototypes/blob/main/seeds/graph-runner/src/types.ts#L234) |

#### Defined in

[protocol.ts:185](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L185)

___

### ProxyRequestMessage

Ƭ **ProxyRequestMessage**: `Object`

The message that is sent by the worker to the host when the board is
requesting to proxy the node.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `id` | `string` | The id of the message. |
| `type` | ``"proxy"`` | The "proxy" type signals to the host that the board is requesting to proxy a node. |
| `data` | { `node`: `NodeDescriptor` ; `inputs`: `InputValues`  } | - |
| `data.node` | `NodeDescriptor` | The description of the node that is requesting to be proxied. **`See`** [NodeDescriptor](https://github.com/google/labs-prototypes/blob/main/seeds/graph-runner/src/types.ts#L54) |
| `data.inputs` | `InputValues` | The input values that the board is providing to the node. **`See`** [InputValues](https://github.com/google/labs-prototypes/blob/main/seeds/graph-runner/src/types.ts#L229) |

#### Defined in

[protocol.ts:208](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L208)

___

### ProxyResponseMessage

Ƭ **ProxyResponseMessage**: `Object`

The message that is sent by the host to the worker after it requested to
proxy the node.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `id` | `string` | The id of the message. |
| `type` | ``"proxy"`` | The "proxy" type signals to the worker that the host is responding to a proxy request. |
| `data` | `OutputValues` | The output values that the host is providing to the board in lieu of the proxied node. **`See`** [OutputValues](https://github.com/google/labs-prototypes/blob/main/seeds/graph-runner/src/types.ts#L234) |

#### Defined in

[protocol.ts:236](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L236)

___

### EndMessage

Ƭ **EndMessage**: `Object`

The message that is sent by the worker to the host when the board is
finished running.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | ``"end"`` | The "end" type signals to the host that the board is finished running. |
| `data` | `unknown` | - |

#### Defined in

[protocol.ts:258](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L258)

___

### ErrorMessage

Ƭ **ErrorMessage**: `Object`

The message that is sent by the worker to the host when the board
encounters an error.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | ``"error"`` | The "error" type signals to the host that the board encountered an error. |
| `data` | { `error`: `string`  } | - |
| `data.error` | `string` | The error message. |

#### Defined in

[protocol.ts:270](https://github.com/google/labs-prototypes/blob/5114223/seeds/breadboard-web/src/protocol.ts#L270)
