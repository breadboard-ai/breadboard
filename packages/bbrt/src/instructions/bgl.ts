/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Temporary hard-coded documentation about BGL to be mounted at /docs so that
 * the model can access it on demand.
 *
 * TODO(aomarks) Manage this content better.
 */
export const BGL_DOCS = {
  "/docs/bgl/index.md": {
    type: "text/markdown",
    content: index(),
  },
  "/docs/bgl/examples/news.bgl.json": {
    type: "application/vnd.breadboard.board",
    content: news(),
  },
  "/docs/bgl/breadboard.schema.json": {
    type: "application/schema+json",
    content: schema(),
  },
};

function index() {
  return `- BGL files have extension ".bgl.json" and MIME type "application/vnd.breadboard.board"
- Read /docs/bgl/breadboard.schema.json for the formal schema
- Read /docs/bgl/examples/news.bgl.json for an example
- The user will see a diagram representing the flow of a BGL program
`;
}

function news() {
  return `{
  "title": "This Moment's News",
  "description": "Researches current trending topics in the US",
  "version": "0.0.1",
  "nodes": [
    {
      "type": "output",
      "id": "output",
      "configuration": {
        "schema": {
          "properties": {
            "context": {
              "type": "array",
              "title": "Context",
              "examples": [],
              "items": {
                "type": "object",
                "behavior": ["llm-content"]
              },
              "default": "null"
            }
          },
          "type": "object",
          "required": []
        }
      },
      "metadata": {
        "visual": {
          "x": 1917.9999999999995,
          "y": 105,
          "collapsed": "expanded"
        }
      }
    },
    {
      "id": "service-547b1623",
      "type": "service",
      "metadata": {
        "visual": {
          "x": 322.9999999999999,
          "y": 37,
          "collapsed": "expanded"
        },
        "title": "Call Trending Now",
        "logLevel": "debug"
      },
      "configuration": {
        "$service": "https://dglazkov-googletrends.web.val.run"
      }
    },
    {
      "id": "runJavascript-c78e3505",
      "type": "runJavascript",
      "metadata": {
        "visual": {
          "x": 672,
          "y": -266,
          "collapsed": "expanded"
        },
        "title": "To Context",
        "logLevel": "debug"
      },
      "configuration": {
        "code": "function run({result}) {\n  return [{ parts: [{ text: JSON.stringify(result) }], role: "user"}]\n}",
        "name": "run",
        "raw": false
      }
    },
    {
      "id": "specialist-e6a3d607",
      "type": "specialist",
      "metadata": {
        "visual": {
          "x": 1130,
          "y": -3.0000000000002274,
          "collapsed": "expanded"
        },
        "title": "News Researcher",
        "logLevel": "debug"
      },
      "configuration": {
        "persona": {
          "role": "user",
          "parts": [
            {
              "text": "You are a news researcher who analyzes the request and formulates an appropriate search query for the Google News tool. Then, you invoke the Google News tool with this query. "
            }
          ]
        },
        "task": {
          "role": "user",
          "parts": [
            {
              "text": "Given the current trends, pick five most interesting topics and make five parallel calls to Google News tool."
            }
          ]
        },
        "tools": ["https://dglazkov-googlenews.web.val.run/bgl"]
      }
    },
    {
      "id": "specialist-8874249e",
      "type": "specialist",
      "metadata": {
        "visual": {
          "x": 1547,
          "y": 31,
          "collapsed": "expanded"
        },
        "title": "Newsbrief Writer",
        "logLevel": "debug"
      },
      "configuration": {
        "persona": {
          "role": "user",
          "parts": [
            {
              "text": "You are a professional Newsbrief writer. Your job is to produce "This Moment's News" newsbrief. Given all the conversation context so far, you comprehensively analyze it and write a newsbrief, covering five topics and an "also worth mentioning" section.\n\nThe brief structure is in Markdown, using the following structure:\n\n-- at the top --\n\n# This Moment's News\n\nA paragraph outlining all topics and summarizing what is happening for each topic as an introduction to the rest of the newsbrief\n\n-- for each topic --\n\n## Title of the topic\n\nBrief summary of what is happening and why it is newsworthy.\n\nA more detailed deep dive into the topic, summarizing all the details that were supplied in the research.\n\n-- at the end --\n\n## Also worth mentioning\n\nA couple of paragraphs on the news topic that didn't get researched comprehensively, but are in the original list of trends and are worthy of mentioning. Write about them as if they were things that are currently developing and might be coming up soon as newsbrief topics."
            }
          ]
        }
      }
    },
    {
      "id": "input-03fe4a18",
      "type": "input",
      "metadata": {
        "visual": {
          "x": -5.999999999999915,
          "y": 74.99999999999977,
          "collapsed": "collapsed"
        },
        "title": "Choose Location",
        "logLevel": "debug"
      },
      "configuration": {
        "schema": {
          "properties": {
            "location": {
              "type": "string",
              "title": "Location",
              "examples": [],
              "enum": ["US", "GB", "FR", "CA", "JP"],
              "default": "US",
              "description": "Choose the locale for the trends: US for the United States, GB for United Kingdom, FR for France, CA for Canada, and JP for Japan"
            }
          },
          "type": "object",
          "required": []
        }
      }
    }
  ],
  "edges": [
    {
      "from": "service-547b1623",
      "to": "runJavascript-c78e3505",
      "in": "result",
      "out": "result"
    },
    {
      "from": "specialist-8874249e",
      "to": "output",
      "in": "context",
      "out": "out"
    },
    {
      "from": "input-03fe4a18",
      "to": "service-547b1623",
      "in": "location",
      "out": "location"
    },
    {
      "from": "runJavascript-c78e3505",
      "to": "specialist-e6a3d607",
      "in": "in",
      "out": "result"
    },
    {
      "from": "specialist-e6a3d607",
      "to": "specialist-8874249e",
      "in": "in",
      "out": "out"
    }
  ],
  "url": "https://breadboard.live/boards/@aerotwist/this-moment-s-news.bgl.json",
  "metadata": {
    "comments": [],
    "tags": ["published"],
    "visual": {}
  }
}
`;
}

function schema() {
  return `{
  "$id": "https://raw.githubusercontent.com/breadboard-ai/breadboard/@google-labs/breadboard-schema@1.11.0/packages/schema/breadboard.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$ref": "#/definitions/GraphDescriptor",
  "definitions": {
    "GraphDescriptor": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "inputs": {
          "$ref": "#/definitions/InputValues",
          "description": "For internal testing only. Do not use.",
          "deprecated": "For internal testing only. Do not use."
        },
        "outputs": {
          "anyOf": [
            {
              "$ref": "#/definitions/OutputValues"
            },
            {
              "type": "array",
              "items": {
                "$ref": "#/definitions/OutputValues"
              }
            }
          ],
          "description": "For internal testing only. Do not use.",
          "deprecated": "For internal testing only. Do not use."
        },
        "sequence": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/NodeIdentifier"
          },
          "description": "For internal testing only. Do not use.",
          "deprecated": "For internal testing only. Do not use."
        },
        "throws": {
          "type": "boolean",
          "description": "For internal testing only. Do not use.",
          "deprecated": "For internal testing only. Do not use."
        },
        "safe": {
          "type": "boolean",
          "description": "For internal testing only. Do not use.",
          "deprecated": "For internal testing only. Do not use."
        },
        "expectedLabels": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "description": "For internal testing only. Do not use.",
          "deprecated": "For internal testing only. Do not use."
        },
        "explanation": {
          "type": "string",
          "description": "For internal testing only. Do not use.",
          "deprecated": "For internal testing only. Do not use."
        },
        "start": {
          "$ref": "#/definitions/NodeIdentifier",
          "description": "For internal testing only. Do not use.",
          "deprecated": "For internal testing only. Do not use."
        },
        "$schema": {
          "type": "string",
          "description": "The schema of the graph."
        },
        "url": {
          "type": "string",
          "description": "The URL pointing to the location of the graph. This URL is used to resolve relative paths in the graph. If not specified, the paths are assumed to be relative to the current working directory."
        },
        "title": {
          "type": "string",
          "description": "The title of the graph."
        },
        "description": {
          "type": "string",
          "description": "The description of the graph."
        },
        "version": {
          "type": "string",
          "description": "Version of the graph. [semver](https://semver.org/) format is encouraged."
        },
        "describer": {
          "type": "string",
          "description": "The URL of the graph that will act as the describer for this graph. Can be a relative URL and refer to a sub-graph within this graph.\n\nThe describers in the format of "module:name" will be interpreted as "use the \`describe\` export of the module named \`name\` to describe this graph"."
        },
        "metadata": {
          "$ref": "#/definitions/GraphMetadata",
          "description": "Metadata associated with the graph."
        },
        "args": {
          "$ref": "#/definitions/InputValues",
          "description": "Arguments that are passed to the graph, useful to bind values to graphs."
        },
        "modules": {
          "$ref": "#/definitions/Modules",
          "description": "Modules that are included as part of this graph."
        },
        "exports": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "$ref": "#/definitions/ModuleIdentifier"
              },
              {
                "type": "string"
              }
            ]
          },
          "description": "The modules and sub-graphs that this graph declares as "exports": they themselves are usable declarative or imperative graphs. When the "exports" property exist, this graph is actually a Kit declaration: it can be used to distributed multiple graphs."
        },
        "virtual": {
          "type": "boolean",
          "const": true,
          "description": "An optional property that indicates that this graph is "virtual": it can not be represented by a static list of edges and nodes, and is instead more of a representation of something that's "graph-like". Modules, when they invoke capabilities, are "virtual" graphs: they don't have a defined topology and instead, this topology is discovered through imperative code execution"
        },
        "main": {
          "$ref": "#/definitions/ModuleIdentifier",
          "description": "The id of the Module that is used as an entry point for this graph. If this value is set, the graph is a "module graph": it is backed by code rather than by nodes and edges."
        },
        "edges": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/Edge"
          },
          "description": "The collection of all edges in the graph."
        },
        "nodes": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/NodeDescriptor"
          },
          "description": "The collection of all nodes in the graph."
        },
        "kits": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/KitDescriptor"
          },
          "description": "All the kits (collections of node handlers) that are used by the graph."
        },
        "graphs": {
          "$ref": "#/definitions/SubGraphs",
          "description": "Sub-graphs that are also described by this graph representation."
        }
      },
      "required": ["edges", "nodes"],
      "description": "A union type of both declarative and imperative graphs. Represents a graph that is either declarative (defined by nodes and edges) or imperative (backed by code)."
    },
    "InputValues": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/definitions/NodeValue"
      },
      "propertyNames": {
        "description": "Unique identifier of a node's input."
      },
      "description": "Values that are supplied as inputs to the \`NodeHandler\`."
    },
    "NodeValue": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "number"
        },
        {
          "type": "boolean"
        },
        {
          "type": "null"
        },
        {
          "not": {}
        },
        {
          "type": "array",
          "items": {
            "$ref": "#/definitions/NodeValue"
          }
        },
        {
          "$ref": "#/definitions/Capability"
        },
        {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/NodeValue"
          }
        }
      ],
      "description": "A type representing a valid JSON value."
    },
    "Capability": {
      "type": "object",
      "properties": {
        "kind": {
          "type": "string"
        }
      },
      "required": ["kind"],
      "additionalProperties": false
    },
    "OutputValues": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/definitions/NodeValue"
      },
      "propertyNames": {
        "description": "Unique identifier of a node's output."
      },
      "description": "Values that the \`NodeHandler\` outputs."
    },
    "NodeIdentifier": {
      "type": "string",
      "description": "Unique identifier of a node in a graph."
    },
    "GraphMetadata": {
      "type": "object",
      "properties": {
        "icon": {
          "type": "string",
          "description": "The icon that identifies the graph. Can be a URL or a Material Design id."
        },
        "comments": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/CommentNode"
          }
        },
        "tags": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/GraphTag"
          },
          "description": "Tags associated with the graph. At this moment, free-form strings."
        },
        "help": {
          "type": "object",
          "properties": {
            "description": {
              "type": "string"
            },
            "url": {
              "type": "string"
            }
          },
          "required": ["url"],
          "additionalProperties": false,
          "description": "The documentation for the graph, expressed as a URL and optional description."
        },
        "describer": {
          "type": "string",
          "description": "The URL of the graph that will act as the describer for this graph. Can be a relative URL and refer to a sub-graph within this graph.\n\nThe describers in the format of "module:name" will be interpreted as "use the \`describe\` export of the module named \`name\` to describe this graph"."
        },
        "visual": {
          "type": "object",
          "properties": {
            "window": {
              "type": "object",
              "properties": {
                "x": {
                  "type": "number"
                },
                "y": {
                  "type": "number"
                },
                "width": {
                  "type": "number"
                },
                "height": {
                  "type": "number"
                }
              },
              "required": ["x", "y", "width", "height"],
              "additionalProperties": false,
              "description": "Last known position of the graph in the editor."
            },
            "minimized": {
              "type": "boolean",
              "description": "Whether or not the graph is minimized. Generally only applies to subgraphs as they carry that control in the Visual Editor."
            }
          },
          "additionalProperties": false,
          "description": "The metadata associated with the visual representation of the graph."
        }
      },
      "additionalProperties": {
        "$ref": "#/definitions/NodeValue"
      },
      "description": "Represents graph metadata."
    },
    "CommentNode": {
      "type": "object",
      "properties": {
        "id": {
          "$ref": "#/definitions/NodeIdentifier",
          "description": "Unique id of the comment node in graph metadata."
        },
        "text": {
          "type": "string",
          "description": "The text content of the comment."
        },
        "metadata": {
          "$ref": "#/definitions/NodeMetadata",
          "description": "The metadata of the comment node. Use this to provide additional information about the comment node."
        }
      },
      "required": ["id", "text"],
      "additionalProperties": false
    },
    "NodeMetadata": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "description": "The title of the node."
        },
        "description": {
          "type": "string",
          "description": "A more detailed description of the node."
        },
        "visual": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            },
            {
              "type": "boolean"
            },
            {
              "type": "null"
            },
            {
              "type": "array",
              "items": {
                "$ref": "#/definitions/NodeValue"
              }
            },
            {
              "$ref": "#/definitions/Capability"
            },
            {
              "type": "object",
              "additionalProperties": {
                "$ref": "#/definitions/NodeValue"
              }
            }
          ],
          "description": "Metadata that conveys visual information about the node. Can be used by visual editors to store information about the node's appearance, current position, etc."
        },
        "logLevel": {
          "type": "string",
          "enum": ["debug", "info"],
          "description": "Logging level."
        },
        "tags": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/NodeTag"
          },
          "description": "Tags associated with the node. Can be either a string or a structured tag, like a \`StartTag\`."
        }
      },
      "additionalProperties": false,
      "description": "Represents metadata of a node. This is an optional part of the \`NodeDescriptor\` that can be used to provide additional information about the node."
    },
    "NodeTag": {
      "type": "string",
      "description": "Represents a tag that can be associated with a node."
    },
    "GraphTag": {
      "type": "string",
      "enum": ["published", "tool", "experimental", "component", "deprecated"],
      "description": "A tag that can be associated with a graph.\n- \`published\`: The graph is published (as opposed to a draft). It may be    used in production and shared with others.\n- \`tool\`: The graph is intended to be a tool.\n- \`experimental\`: The graph is experimental and may not be stable.\n- \`component\`: The graph is intended to be a component."
    },
    "Modules": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/definitions/Module"
      },
      "propertyNames": {
        "description": "Unique identifier of a module."
      }
    },
    "Module": {
      "type": "object",
      "properties": {
        "metadata": {
          "$ref": "#/definitions/ModuleMetadata",
          "description": "Metadata associated with the graph."
        },
        "code": {
          "$ref": "#/definitions/ModuleCode",
          "description": "The code for this module."
        }
      },
      "required": ["code"],
      "additionalProperties": false
    },
    "ModuleMetadata": {
      "type": "object",
      "properties": {
        "runnable": {
          "type": "boolean",
          "description": "Whether the module should be presented as a runnable item to runModule."
        },
        "icon": {
          "type": "string",
          "description": "The icon for the module."
        },
        "url": {
          "type": "string",
          "description": "The source file for the module, if relevant."
        },
        "description": {
          "type": "string",
          "description": "The description for the module."
        },
        "title": {
          "type": "string",
          "description": "The title for the module."
        },
        "tags": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/ModuleTag"
          },
          "description": "Tags associated with the module. At this moment, free-form strings."
        },
        "help": {
          "type": "object",
          "properties": {
            "description": {
              "type": "string"
            },
            "url": {
              "type": "string"
            }
          },
          "required": ["url"],
          "additionalProperties": false,
          "description": "The documentation for the module, expressed as a URL and optional description."
        },
        "source": {
          "type": "object",
          "properties": {
            "language": {
              "$ref": "#/definitions/ModuleLanguage"
            },
            "code": {
              "$ref": "#/definitions/ModuleCode"
            }
          },
          "required": ["language", "code"],
          "additionalProperties": false,
          "description": "The pre-compiled source for this module."
        }
      },
      "additionalProperties": false
    },
    "ModuleTag": {
      "type": "string",
      "enum": ["published", "experimental"],
      "description": "A tag that can be associated with a graph.\n- \`published\`: The module is published (as opposed to a draft). It may be    used in production and shared with others.\n- \`experimental\`: The graph is experimental and may not be stable."
    },
    "ModuleLanguage": {
      "type": "string"
    },
    "ModuleCode": {
      "type": "string",
      "description": "The code for this module, which should include a describer, an invoker, and any other relevant information to power the module."
    },
    "ModuleIdentifier": {
      "type": "string",
      "description": "Unique identifier of a module."
    },
    "Edge": {
      "type": "object",
      "properties": {
        "from": {
          "$ref": "#/definitions/NodeIdentifier",
          "description": "The node that the edge is coming from."
        },
        "to": {
          "$ref": "#/definitions/NodeIdentifier",
          "description": "The node that the edge is going to."
        },
        "in": {
          "$ref": "#/definitions/InputIdentifier",
          "description": "The input of the \`to\` node. If this value is undefined, then the then no data is passed as output of the \`from\` node."
        },
        "out": {
          "$ref": "#/definitions/OutputIdentifier",
          "description": "The output of the \`from\` node. If this value is "*", then all outputs of the \`from\` node are passed to the \`to\` node. If this value is undefined, then no data is passed to any inputs of the \`to\` node."
        },
        "optional": {
          "type": "boolean",
          "description": "If true, this edge is optional: the data that passes through it is not considered a required input to the node."
        },
        "constant": {
          "type": "boolean",
          "description": "If true, this edge acts as a constant: the data that passes through it remains available even after the node has consumed it."
        }
      },
      "required": ["from", "to"],
      "additionalProperties": false,
      "description": "Represents an edge in a graph."
    },
    "InputIdentifier": {
      "type": "string",
      "description": "Unique identifier of a node's input."
    },
    "OutputIdentifier": {
      "type": "string",
      "description": "Unique identifier of a node's output."
    },
    "NodeDescriptor": {
      "type": "object",
      "properties": {
        "id": {
          "$ref": "#/definitions/NodeIdentifier",
          "description": "Unique id of the node in graph."
        },
        "type": {
          "$ref": "#/definitions/NodeTypeIdentifier",
          "description": "Type of the node. Used to look up the handler for the node."
        },
        "configuration": {
          "$ref": "#/definitions/NodeConfiguration",
          "description": "Configuration of the node."
        },
        "metadata": {
          "$ref": "#/definitions/NodeMetadata",
          "description": "The metadata of the node. Use this provide additional information about the node."
        }
      },
      "required": ["id", "type"],
      "additionalProperties": false,
      "description": "Represents a node in a graph."
    },
    "NodeTypeIdentifier": {
      "type": "string",
      "description": "Unique identifier of a node's type."
    },
    "NodeConfiguration": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/definitions/NodeValue"
      },
      "description": "Values that are supplied as part of the graph. These values are merged with the \`InputValues\` and supplied as inputs to the \`NodeHandler\`."
    },
    "KitDescriptor": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "title": {
          "type": "string",
          "description": "The title of the kit."
        },
        "description": {
          "type": "string",
          "description": "The description of the kit."
        },
        "version": {
          "type": "string",
          "description": "Version of the kit. [semver](https://semver.org/) format is encouraged.",
          "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$"
        },
        "tags": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/KitTag"
          },
          "description": "Tags, associated with the kit."
        },
        "url": {
          "type": "string",
          "description": "The URL pointing to the location of the kit."
        }
      },
      "required": ["url"]
    },
    "KitTag": {
      "type": "string",
      "enum": ["deprecated", "experimental"],
      "description": "Represents various tags that can be associated with a kit.\n- \`deprecated\`: The kit is deprecated and should not be used.\n- \`experimental\`: The kit is experimental and may not be stable."
    },
    "SubGraphs": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/definitions/GraphDescriptor"
      },
      "propertyNames": {
        "description": "Unique identifier of a graph."
      },
      "description": "Represents a collection of sub-graphs. The key is the identifier of the sub-graph. The value is the descriptor of the sub-graph."
    }
  }
}
`;
}
