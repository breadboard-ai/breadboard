/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Screen, Prompt } from "../types";

export const spec = `
Make a blog post writer. It takes a topic, then does some research on it, then writes an outline, then generates an snazzy header graphic based on this outline, and in parallel, writes the blog post based on the outline. Then shows the header graphic and the blog post as a final result.
`;

export const screens: Screen[] = [
  {
    screenId: "get_topic",
    description: "Prompts the user to enter a topic for the blog post.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    events: [
      {
        eventId: "write_post",
        description: "User submits a topic to start the writing process.",
        outputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The topic for the blog post.",
            },
          },
          required: ["topic"],
        },
      },
    ],
  },
  {
    screenId: "writing_in_progress",
    description: "Displays the progress of the blog post generation.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description:
            "A message indicating the current step, e.g., 'Researching topic...', 'Generating outline...', 'Writing post...'",
        },
      },
      required: ["status"],
    },
    events: [],
  },
  {
    screenId: "show_result",
    description: "Displays the final generated blog post and header graphic.",
    inputSchema: {
      type: "object",
      properties: {
        header_graphic: {
          type: "string",
          description: "VFS path to the generated header graphic.",
        },
        blog_post: {
          type: "string",
          description: "The full blog post content in Markdown format.",
        },
      },
      required: ["header_graphic", "blog_post"],
    },
    events: [
      {
        eventId: "start_over",
        description: "User wants to write a new blog post.",
      },
    ],
  },
];

export const prompts: Prompt[] = [
  {
    name: "create-outline",
    description:
      "Researches a topic and creates a structured outline and research summary for a blog post.",
    format: "json",
    arguments: [
      {
        name: "topic",
        description: "The topic for the blog post.",
        required: true,
      },
    ],
    responseSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "A compelling title for the blog post.",
        },
        research_summary: {
          type: "string",
          description:
            "A concise summary of the key findings from the research on the topic. This will be used to inform the writing process.",
        },
        outline: {
          type: "object",
          properties: {
            introduction: {
              type: "string",
              description:
                "A bullet point or short sentence for the introduction's main theme.",
            },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  heading: {
                    type: "string",
                    description:
                      "The heading for this section of the blog post.",
                  },
                  points: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                    description:
                      "An array of key points or sub-topics to cover in this section.",
                  },
                },
                required: ["heading", "points"],
              },
            },
            conclusion: {
              type: "string",
              description:
                "A bullet point or short sentence for the conclusion's main message.",
            },
          },
          required: ["introduction", "sections", "conclusion"],
        },
      },
      required: ["title", "research_summary", "outline"],
    },
    value:
      'You are a research assistant and content strategist. Your task is to research the given topic and create a comprehensive plan for a blog post. \n\nTopic: "{{topic}}"\n\nFirst, perform research to gather key information, facts, and different perspectives on the topic. Then, based on your research, generate a JSON object that includes a catchy title, a summary of your research findings, and a detailed outline for the blog post. The outline should have an introduction, multiple sections with headings and bullet points, and a conclusion. Use built-in search tool to do the research',
  },
  {
    name: "create-image-prompt",
    description:
      "Creates a detailed, artistic prompt for an image generation model based on a blog post outline and research.",
    format: "json",
    arguments: [
      {
        name: "research_and_outline_json",
        description:
          "The JSON object containing the title, research summary, and outline.",
        required: true,
      },
    ],
    responseSchema: {
      type: "object",
      properties: {
        image_prompt: {
          type: "string",
          description:
            "A detailed, artistic, and visually rich prompt for generating a header image.",
        },
      },
      required: ["image_prompt"],
    },
    value:
      "You are a creative director. Based on the following blog post plan, create a single, concise, yet evocative and visually rich prompt for an AI image generator to create a header graphic. The prompt should capture the main theme and tone of the article. Respond with a JSON object containing the `image_prompt`.\n\nBlog Post Plan:\n{{research_and_outline_json}}",
  },
  {
    name: "generate-header-graphic",
    description: "Generates a header graphic for a blog post.",
    format: "image",
    arguments: [
      {
        name: "prompt",
        description: "The detailed, artistic prompt for the image generator.",
        required: true,
      },
    ],
    value: "{{prompt}}",
  },
  {
    name: "write-blog-post",
    description:
      "Writes a full blog post based on a provided outline and research summary.",
    format: "text",
    arguments: [
      {
        name: "research_and_outline_json",
        description:
          "The JSON object containing the title, research summary, and outline.",
        required: true,
      },
    ],
    value:
      "You are an expert blog writer. Your task is to write a comprehensive, engaging, and well-structured blog post based on the provided plan. Use Markdown for formatting. Ensure the tone is appropriate for the topic and that the content flows logically from one section to the next.\n\nBlog Post Plan:\n{{research_and_outline_json}}\n\nNow, write the full blog post.",
  },
];
