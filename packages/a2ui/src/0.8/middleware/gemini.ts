/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse } from "http";
import { Plugin, ViteDevServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import * as JSONSchema from "jsonschema";
import ClientEvent from "../schemas/client-event.json";
import {
  A2UIClientEventMessage,
  ClientCapabilitiesDynamic,
} from "../types/client-event";
import { createA2UIPrompt, createImageParsePrompt } from "./prompts";
import { isObject } from "../data/guards";

// TODO: Reenable.
// import { A2UIProtocolMessage } from "../schemas/a2ui-message.js";

const validator = new JSONSchema.Validator();
validator.addSchema(ClientEvent);

let catalog: ClientCapabilitiesDynamic | null = null;
let ai: GoogleGenAI;
export const plugin = (): Plugin => {
  if (!("GEMINI_API_KEY" in process.env && process.env.GEMINI_KEY !== "")) {
    throw new Error("No GEMINI_API_KEY environment variable; add one to .env");
  }

  return {
    name: "custom-gemini-handler",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/a2ui",
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (!ai) {
            ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          }

          if (req.method === "POST") {
            let contents = "";

            req.on("data", (chunk) => {
              contents += chunk.toString();
            });

            req.on("end", async () => {
              try {
                const payload = JSON.parse(contents) as A2UIClientEventMessage;
                if (payload.clientUiCapabilities || payload.userAction) {
                  const payloadValidation = validator.validate(
                    payload,
                    ClientEvent
                  );

                  if (payloadValidation.errors.length > 0) {
                    console.warn(payloadValidation);
                    throw new Error("Invalid payload");
                  }

                  if (payload.clientUiCapabilities) {
                    if ("dynamicCatalog" in payload.clientUiCapabilities) {
                      catalog = payload.clientUiCapabilities.dynamicCatalog;

                      res.statusCode = 200;
                      res.setHeader("Content-Type", "application/json");
                      res.end(
                        JSON.stringify({
                          role: "model",
                          parts: [{ text: "Dynamic Catalog Received" }],
                        })
                      );
                      return;
                    }
                  } else if (payload.userAction) {
                    // TODO: Handle user actions.
                    return;
                  }
                } else {
                  // Other payload - assume this is a user request.
                  if (!payload.request || !catalog) {
                    res.statusCode = 400;
                    res.setHeader("Content-Type", "application/json");
                    res.end(
                      JSON.stringify({
                        error: `Invalid message - No payload or catalog`,
                      })
                    );
                    return;
                  }

                  if (isObject(payload.request)) {
                    const request = payload.request as {
                      imageData?: string;
                      instructions: string;
                    };

                    let imageDescription = "";
                    if (
                      request.imageData &&
                      request.imageData.startsWith("data:")
                    ) {
                      const mimeType = /data:(.*);/
                        .exec(request.imageData)
                        ?.at(1);
                      if (!mimeType) {
                        throw new Error("Invalid inline data");
                      }
                      const data = request.imageData.substring(
                        `data:${mimeType};base64,`.length
                      );
                      const contentPart = {
                        inlineData: {
                          mimeType,
                          data,
                        },
                      };

                      const prompt = createImageParsePrompt(
                        catalog,
                        contentPart
                      );
                      const modelResponse = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: prompt,
                        config: {
                          systemInstruction: `
                        You are working as part of an AI system, so no chit-chat and
                        no explaining what you're doing and why.DO NOT start with
                        "Okay", or "Alright" or any preambles. Just the output,
                        please.`,
                        },
                      });
                      imageDescription = modelResponse.text ?? "";
                    }

                    const prompt = createA2UIPrompt(
                      catalog,
                      imageDescription,
                      request.instructions
                    );

                    const modelResponse = await ai.models.generateContent({
                      model: "gemini-2.5-flash",
                      contents: prompt,
                      config: {
                        // responseMimeType: "application/json",
                        // responseJsonSchema: {
                        //   type: "array",
                        //   items: A2UIProtocolMessage,
                        // },
                        systemInstruction: `Please return a valid array
                        necessary to satisfy the user request. If no data is
                        provided create some. If there are any URLs you must
                        make them absolute and begin with a /.

                        Nothing should ever be loaded from a remote source.

                        You are working as part of an AI system, so no chit-chat and
                        no explaining what you're doing and why.DO NOT start with
                        "Okay", or "Alright" or any preambles. Just the output,
                        please.

                        ULTRA IMPORTANT: *Just* return the A2UI Protocol
                        Message object, do not wrap it in markdown. Just the object
                        please, nothing else!`,
                      },
                    });
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.end(
                      JSON.stringify({
                        role: "model",
                        parts: [{ text: modelResponse.text }],
                      })
                    );
                  } else {
                    throw new Error("Expected request to be an object");
                  }
                }
              } catch (err) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: `Invalid message - ${err}`,
                  })
                );
              }
            });

            return;
          } else {
            next();
          }
        }
      );
    },
  };
};
