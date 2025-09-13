Process each picture by automatically cropping and enhancing it and return the
processed pictures.

To accomplish this task, write a Javascript module with a single async function
as a default export. The module runs in an isolated environment that has the
latest ECMAScript features, but no additional bindings. The function you will
write is defined as `Invoke` type below:

```ts
declare type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | Array<JsonSerializable>
  | {
      [K: string]: JsonSerializable;
    };

type CallToolRequest = {
  name: string;
  arguments: Record<string, JsonSerializable>;
};

type TextContent = {
  type: "text";
  text: string;
};

type ImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

type AudioContent = {
  type: "audio";
  data: string;
  mimeType: string;
};

type ResourceLinkContent = {
  type: "resource_link";
  uri: string;
  mimeType: string;
};

type ContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceLinkContent;

type CallToolResponse = {
  content: ContentBlock[];
  isError: boolean;
};

type McpClient = {
  callTool(params: CallToolRequest): Promise<CallToolResponse>;
};

type Console = {
  /**
   * Call this method to report errors.
   * @param params -- useful information about the error, usually strings
   */
  error(...params: any[]): void;
  /**
   * Call this method to log progress.
   * @param params -- useful information to log, usually strings
   */
  log(...params: any[]): void;
};

type Capabilities = {
  mcp: McpClient;
  console: Console;
};

export type Invoke = (capabilities: Capabilities) => Promise<ContentBlock[]>;
```

The following tools are available via `mcp` capability:

```json
[
  {
    "name": "process_image",
    "title": "Image Processor",
    "description": "Automatically crops and enhances provided image. The output is a resource_link with with the uri pointing at the processed image",
    "inputSchema": {
      "type": "object",
      "properties": {
        "image_path": {
          "type": "string",
          "description": "VFS path to the image"
        }
      },
      "required": ["image_path"]
    }
  }
]
```

Any files in this prompt will be provided to the program as
"/vfs/in/file\_[x].[ext]" files, where x is the index of the file provided and
the ext is the extension of the file, based on its MIME type.

When providing files as outputs, output them as `resource_link` structures in
the `ContentBlock`, converting paths to URIs like this: `file://${path}`.

Make sure to write Javascript, not Typescript. Output it in markdown code
fences.
