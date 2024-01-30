# Remote Breadboard

Breadboard strives to be the basis for distributed systems, and already has several provisions for running boards that span multiple computing environments or "remoting".

There are two main modes of remoting:

- **Node Proxying** -- nodes in a board can run in a different environment from the one where the board is being run. For example, a board can run on main thread in a browser, while the board nodes are running in a web worker. Or they can run on a different server altogether.

- **Running** -- the board itself can run in a different environment from where it is invoked. For example, a Web app could request running a board, but the board itself would run in on a server (or a Web worker or an iframe).

## Clients, Servers, and Transports

To facilitate remoting, Breadboard relies on three key concepts: clients, servers, and transports.

The client and server form a pair that communicate with each other over a transport.

To match the remoting modes, there are currently two clients and two servers:

- **ProxyClient** makes requests to proxy a node to a differen environment.

- **ProxyServer** receives ProxyClient's requests and runs nodes, proxying inputs and outputs over a transport.

- **RunClient** makes requests to run a board in a different environment.

- **RunServer** receives RunClient's requests and runs the board, proxying board's run state inputs and outputs over a transport.

The transport provides the means of communicating between the client and the server. Currently, there are four transports (one for each client/server pair):

- **WorkerServerTransport** and **WorkerClientTransport** to communicate between a client and a server over a Web worker boundary.

- **HTTPServerTransport** and **HTTPClientTransport** to communicate between a client and a server over HTTP.

The transports, servers, and clients are designed to combine with each other. The transports are designed to be interchangeable.

For example, to create a proxy server that runs in a Web worker, we can combine the `ProxyServer` with the `WorkerServerTransport`:

```ts
const server = new ProxyServer(new WorkerServerTransport(...));
```

A corresponding proxy client that runs on main thread will be initialized like this:

```ts
const client = new ProxyClient(new WorkerClientTransport(...));
```

Should we want to switch to HTTP transport, we can do so by replacing the transport:

```ts
const server = new ProxyServer(new HTTPServerTransport(...));
```

and

```ts
const client = new ProxyClient(new HTTPClientTransport(...));
```

Underneath, both HTTP and Worker transports use the same protocol. The main difference is that for the Worker transport, the messages can be exchanged continuously, while for the HTTP transport, there can be only one request (with one or more responses streaming back) per message exchange.

The client and server implementations are designed to recognize and handle this difference, so that the consumer of the client/server pair doesn't have to worry about it.

The Worker transport relies on the single instance of the `MessageChannel` to commmunicate, while the HTTP transport relies on multiple invocations of `fetch`.

## Proxy kits

To help integrate into the run of a board, proxy clients produce a special kind of kits: proxy kits. A proxy kit mimics the nodes that are being proxied: instead of running them locally, it proxies their inputs and outputs to the remote server.

For example, to proxy nodes `a` and `b` to a remote server, we can do this:

```ts
const proxyKit = await client.createProxyKit(["a", "b"]);
```

And then, when we run the board, we can pass the proxy kit as an argument:

```ts
const run = await board.run({ kits: [proxyKit, ...otherKits] });
```

The nodes of the proxy kit will override the nodes in `otherKits` and will be used instead.

## Streams and remoting

The remoting is able to handle streams. For example, if a node output contains streams, they will be correctly passed to across the transport to the other side. The Worker transport uses the [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) capaiblity to pass the streams, while the HTTP transport interweaves the stream data as part of HTTP response.
