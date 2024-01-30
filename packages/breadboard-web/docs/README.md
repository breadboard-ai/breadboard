@google-labs/breadboard-web / [Exports](modules.md)

# Breadboard Web Runtime

This is the package that contains all necessary infrastructure to run a Breadboard application in a web browser.

## The Worker Communication Protocol

The worker communicates with its host using a simple message protocol. The protocol is defined in [protocol.ts](src/protocol.ts) and documented in the [API documentation](docs/api/README.md).

The general message format used to communicate with the worker consists of three parts:

- The `id` of the message (optional)
- The `type` of the message
- The `data` payload of the message

The payload will vary depending on the type of the message.

Some messages are "one-way" messages and some are "round-trip" messages. The difference is that the sender of a "round-trip" message expects a response from the receiver.

The presence of the `id` field indicates that this is a "round-trip" message. The receiver of this message must respond with a message of the same type and the same id.

The protocol allows the following types of messages:

- `load` -- sent by the host to load the board
- `start` -- sent by the host to load the board and to start running it
- `input` -- sent by the worker when the board is requesting input (a round-trip message)
- `output` -- sent by the worker when the board is producing output
- `beforehandler` -- sent by the worker when the board is about to run a handler for a node. These messages are useful for indicating the progress of the board's run.
- `proxy` -- sent by the worker when the board is requesting a proxy object (a round-trip message)
- `end` -- sent by the worker when the board is done running
- `error` -- sent by the worker when an error occurs

Any other types of messages cause an error to be thrown by the worker and abort running of the board.

## Typical Lifecycle

The typical worker lifecycle is as follows:

1. The host sends a `load` message to the worker, supplying the board to load.
2. The worker loads the board and sends a `load` message with the information about the board back to the host.
3. The host sends a `start` message to the worker.
4. The worker loads the board and sends a `beforehandler` message to the host for each node that is about to be run.
5. The worker sends an `input` message to the host for each node that requires input.
6. The host responds to each `input` message with an `input` message containing the input values for the node.
7. The worker sends an `output` message to the host for each node that is producing output.
8. The worker sends a `proxy` message to the host for each node that is requesting a proxy object.
9. The host responds to each `proxy` message with a `proxy` message containing the proxy object for the node.
10. The worker sends an `end` message to the host when the board is done running.
11. If an error occurs, the worker sends an `error` message to the host.

# Firebase bits

Must have firebase CLI installed:

```bash
npm install -g firebase-tools
```

Set project (PROJECT_ID is the ID of the project in the Firebase console):

```bash
firebase use --add ${PROJECT_ID}
```
