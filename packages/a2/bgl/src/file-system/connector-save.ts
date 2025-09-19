/**
 * @fileoverview Connector Save Export.
 */
import { type DescribeOutputs } from "@describe";
import { ok } from "../a2/utils";

export { invoke as default, describe };

type Inputs = {
  id: string;
  method: "canSave" | "save";
  context?: LLMContent[];
};

type Outputs =
  | {
      context: LLMContent[];
    }
  | {
      canSave: boolean;
    };

function createPackageJson(): LLMContent[] {
  return [
    {
      parts: [
        {
          json: {
            name: "new-project",
            version: "1.0.0",
            main: "index.js",
            scripts: {
              start: "http-server .",
            },
            keywords: [],
            author: "",
            license: "ISC",
            description: "",
            dependencies: {
              "http-server": "^14.1.1",
            },
          },
        },
      ],
    },
  ];
}

async function writeFile(
  caps: Capabilities,
  dir: string,
  name: string,
  data: LLMContent[]
): Promise<Outcome<void>> {
  const path: FileSystemPath = `/mnt/fs/${dir}/${name}`;
  return caps.write({ path, data });
}

async function invoke(
  { id, context }: Inputs,
  caps: Capabilities
): Promise<Outcome<Outputs>> {
  if (!context) {
    console.warn("No data to save");
    return { context: [] };
  }
  const writingIndex = await writeFile(caps, id, "index.html", context);
  if (!ok(writingIndex)) return writingIndex;

  const writingPackage = await writeFile(
    caps,
    id,
    "package.json",
    createPackageJson()
  );
  if (!ok(writingPackage)) return writingPackage;
  return { context };
}

async function describe() {
  return {
    title: "Save To Local File System",
    metadata: {
      tags: ["connector-save"],
    },
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
        },
      },
    } satisfies Schema,
  } satisfies DescribeOutputs;
}
