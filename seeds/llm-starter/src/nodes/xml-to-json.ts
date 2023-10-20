/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeHandler,
  NodeValue,
  OutputValues,
} from "@google-labs/breadboard";
import {
  XmlCdata,
  XmlComment,
  XmlDocument,
  XmlElement,
  XmlText,
  parseXml,
} from "@rgrove/parse-xml";

export type XmlToJsonOutputs = {
  json: unknown;
};

export type XmlToJsonInputs = {
  /**
   * The string that contains the XML to convert to JSON
   * @example `<foo><bar>baz</bar></foo>`
   */
  xml: string;
};

const properName = (name: string) => {
  return name.replace(/:/g, "$");
};

/**
 * Converts to alt-json format, as outlined in:
 * https://developers.google.com/gdata/docs/json
 * @param node
 * @returns
 */
const toAltJson = (
  node: XmlElement | XmlDocument | XmlText | XmlCdata | XmlComment
): [string, NodeValue] => {
  if (node.type === "document") {
    const doc = node as XmlDocument;
    const element = doc.children[0] as XmlElement;
    const [name, value] = toAltJson(element);
    return ["$doc", element ? { [name]: value } : ""];
  }
  if (node.type === "element") {
    const element = node as XmlElement;
    const childEntries = element.children.map(toAltJson) as [string, unknown][];
    const children = Object.fromEntries(
      childEntries.reduce((map, [name, value]) => {
        map.has(name) ? map.get(name).push(value) : map.set(name, [value]);
        return map;
      }, new Map())
    );
    return [properName(element.name), { ...children, ...element.attributes }];
  }
  if (node.type === "text") {
    const text = node as XmlText;
    return ["$t", text.text];
  }
  return ["$c", ""];
};

export default {
  describe: async () => {
    return {
      inputSchema: {
        properties: {
          xml: {
            title: "XML",
            description: "Valid XML as a string",
          },
        },
      },
      outputSchema: {
        properties: {
          json: {
            title: "JSON",
            description:
              "JSON representation of the input XML. Represented as alt-json, described in https://developers.google.com/gdata/docs/json",
          },
        },
      },
    };
  },
  invoke: async (inputs: InputValues): Promise<OutputValues> => {
    const { xml } = inputs as XmlToJsonInputs;
    if (!xml) throw new Error("XmlToJson requires `xml` input");
    const json = toAltJson(parseXml(xml));
    return { json };
  },
} satisfies NodeHandler;
