import "jsr:@std/dotenv/load";

// The API endpoint for the board
const BOARD_API_ENDPOINT =
  "https://breadboard-community.wl.r.appspot.com/boards/@AgileChicken/chat-with-your-cat.bgl.api/run";
// The Board Server API Key (stored  in the environment)
const BB_COMMUNITY_KEY = Deno.env.get("BOARD_SERVER_API_KEY");

Deno.serve(server);

async function server(req: Request): Promise<Response> {
  const { method } = req;
  if (method === "GET") {
    // This board has no starting input, so we kick off the run API with
    // no arguments to get it going.
    const response = await callApiEndpoint();
    // Render a simple frontend.
    return renderFrontend(response);
  }
  if (method === "POST") {
    // Get the form data from the page.
    const formData = await req.formData();
    const request: ChatRequest = {
      message: formData.get("message") as string,
      next: formData.get("next") as string,
    };
    if (!request.message) {
      return new Response("Missing message", { status: 400 });
    }

    const response = await callApiEndpoint(request);
    return renderFrontend(response);
  }

  return new Response("Method not allowed", { status: 405 });
}

async function callApiEndpoint(request?: ChatRequest): Promise<ChatResponse> {
  const payload: Payload = {
    $key: BB_COMMUNITY_KEY,
    $next: request?.next || undefined,
    text: request?.message
      ? {
          role: "user",
          parts: [{ text: request.message }],
        }
      : undefined,
  };

  const response = await fetch(BOARD_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // The response is a stream of Server-Sent Events, so we just read it
  // as one text block.
  const text = await response.text();
  // ... and then parse line by line.
  const lines = text.split("\n\n");

  let receivedNext: string | undefined;
  const messages: LLMContent[] = [];
  for (const line of lines) {
    const trimmed = line.replace("data: ", "").trim();
    if (!trimmed) continue;
    const [type, data, next] = JSON.parse(trimmed);
    switch (type) {
      case "input": {
        receivedNext = next;
        break;
      }
      case "output": {
        Object.values(data.outputs)
          .map((port) => {
            const contentArray = (port as LLMContent[]).filter(
              (o) => o.role !== "$metadata"
            );
            const last = contentArray[contentArray.length - 1];
            return last;
          })
          .forEach((o) => messages.push(o));
        break;
      }
      case "error": {
        console.error("Error:", data);
        break;
      }
    }
  }

  return {
    message: messages
      .flatMap((m) => {
        return m.parts
          .map((p) => {
            if ("text" in p) {
              return p.text;
            }
            return null;
          })
          .filter(Boolean);
      })
      .join("\n"),
    next: receivedNext,
  };
}

// A very, very simple frontend.
function renderFrontend(response: ChatResponse) {
  const { next, message } = response;
  return new Response(
    `<!DOCTYPE html>
    <h1>Chat with your cat</h1>
    <form method="POST">
    ${next ? `<input type="hidden" name="next" value="${next}" />` : ""}
    ${
      message
        ? `<p>Cat says:</p>
    <p>${message}</p>`
        : ""
    }
    <p>
        <label>Your message:
        <input type="text" name="message" required></label>
        <input type="submit" value="Send">
    </p>
    </form>
    `,
    {
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
}

// ---- Types

export type ChatRequest = {
  message: string;
  next?: string;
};

export type ChatResponse = ChatRequest;

export type Payload = {
  $key?: string;
  $next?: string;
  text?: LLMContent;
};

export type LLMTextPart = {
  text: string;
};

export type LLMContent = {
  role: string;
  parts: LLMTextPart[];
};
