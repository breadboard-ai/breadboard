import {
  AnyProxyRequestMessage,
  HTTPServerTransport,
  ProxyServer,
  ProxyServerConfig,
  ServerResponse,
} from "@google-labs/breadboard/remote";
import http from "http";
import handler from "serve-handler";

const extractRequestBody = async (request: http.IncomingMessage) => {
  return new Promise<AnyProxyRequestMessage>((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      resolve(JSON.parse(body) as AnyProxyRequestMessage);
    });
    request.on("error", reject);
  });
};

/*
  This is a simple implementation of a ResponseHandler for the HTTPServerProxyTransport. It maps http.ServerResponse on to an express-lie response object.
*/
class ResponseHandler implements ServerResponse {
  #response: http.ServerResponse<http.IncomingMessage>;
  constructor(private response: http.ServerResponse<http.IncomingMessage>) {
    this.#response = response;
  }

  header(field: string, value: string) {
    this.#response.setHeader(field, value);
    return;
  }
  write(chunk: unknown) {
    return this.#response.write(chunk);
  }
  end() {
    this.#response.end();
  }
}

export const startServer = async (
  dist: string,
  port: string,
  config: ProxyServerConfig
) => {
  const server = http.createServer(async (request, response) => {
    if (request.method === "POST") {
      const body = await extractRequestBody(request);
      const responseHandler = new ResponseHandler(response);

      const server = new ProxyServer(
        new HTTPServerTransport({ body }, responseHandler)
      );
      try {
        await server.serve(config);
      } catch (e) {
        response.statusCode = 500;
        response.write(`500 Server Error: ${(e as Error).message}`);
      }
      return;
    }

    return handler(request, response, {
      public: dist,
      cleanUrls: ["/"],
    });
  });

  server.listen(port, () => {
    console.log(`Running at http://localhost:${port}/`);
  });
};
