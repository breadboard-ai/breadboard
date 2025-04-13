/**
 * @fileoverview Slides bits.
 */

import type {
  SlidesRequest,
  SlidesPredefinedLayout,
  SlidesCreateSlideRequest,
  SlidesInsertTextRequest,
  SlidesUpdateTextStyleRequest,
  SlidesLayoutPlaceholderIdMapping,
  SlidesTextStyle,
} from "./api";
import type {
  Token,
  ImageToken,
  FormattingToken,
  ListToken,
  HeadingToken,
  ListItemToken,
} from "./types";
import { unescape } from "./unescape";
import { marked } from "./marked";

export { SlideBuilder, slidesToRequests };

// Slide Structure:
// - Slide contains optional title, bodies, and text
// - Text is string with styles and lists
// - Style is various style flags + range
// - Body is text and or images

export type Slide = {
  objectId: string;
  layout: SlidesPredefinedLayout;
  title?: SlideText;
  subtitle?: SlideText;
  body: SlideBody[];
};

export type SlideText = {
  text: string;
  styles: SlideStyle[];
  lists: SlideRange[];
  images?: number[];
};

export type SlideRange = {
  start: number;
  end: number;
};

export type SlideStyle = {
  range: SlideRange;
  bold?: boolean;
  italic?: boolean;
  link?: string;
  underline?: boolean;
  strikethrough?: boolean;
};

export type SlideBody = {
  text?: SlideText;
};

class SlideBuilder {
  #slides: Slide[] = [];
  #images: ImageToken[] = [];

  readonly #startIndex: number;
  readonly #objectToDelete: string | undefined;
  #depthAdjustment: number = 0;

  constructor(startIndex: number = 0, objectId?: string) {
    this.#startIndex = startIndex;
    this.#objectToDelete = objectId;
    this.#newSlide();
  }

  addMarkdown(markdown: string) {
    let bodyText = this.#getBodyText();
    if (this.#slide.title || bodyText.text || bodyText.images?.length) {
      this.#newSlide();
    }
    const tokens = marked.lexer(markdown) as Token[];
    tokens.forEach((token) => this.#addToken(token));
  }

  #hasContent() {}

  addInlineData(data: InlineDataCapabilityPart["inlineData"]) {
    let bodyText = this.#getBodyText();
    if (this.#slide.title || bodyText.text || bodyText.images?.length) {
      this.#newSlide();
      bodyText = this.#getBodyText();
    }
    bodyText.images ??= [];
    bodyText.images.push(
      this.#addImage({
        type: "image",
        href: `data:${data.mimeType};base64,${data.data}`,
      } as ImageToken)
    );
  }

  #addToken(token: Token) {
    const { type } = token;
    switch (type) {
      case "hr":
        this.#newSlide();
        break;
      case "paragraph":
        this.#newParagraph(token.tokens);
        break;
      case "heading":
        this.#newHeading(token);
        break;
      case "list":
        this.#addListToBody(token);
        break;
    }
  }

  images() {
    return this.#images;
  }

  build(imageUrls: string[]) {
    this.#finalizeSlide();
    console.log("SLIDES", this.#slides);
    const requests = slidesToRequests(this.#slides, imageUrls);
    if (this.#objectToDelete) {
      requests.unshift({
        deleteObject: {
          objectId: this.#objectToDelete,
        },
      });
    }
    return requests;
  }

  get #slide(): Slide {
    return this.#slides.at(-1)!;
  }

  #newHeading(token: HeadingToken) {
    if (token.depth === 1) {
      this.#slide.title = this.#parseText(token.tokens);
    } else {
      this.#slide.subtitle = this.#parseText(token.tokens);
    }
  }

  #newParagraph(tokens: FormattingToken[]) {
    const bodyText = this.#getBodyText();
    const offset = bodyText.text.length - this.#depthAdjustment;
    const {
      text,
      styles,
      lists,
      images = [],
    } = this.#parseText(tokens, offset);
    bodyText.text += text;
    bodyText.styles.push(...styles);
    bodyText.lists.push(...lists);
    bodyText.images ??= [];
    bodyText.images.push(...images);
  }

  #getBodyText() {
    const slide = this.#slide;
    if (!slide.body.length) {
      slide.body.push({
        text: { text: "", styles: [], lists: [] },
      });
    }
    const body = slide.body.at(-1)!;
    if (!body.text) {
      body.text = { text: "", styles: [], lists: [] };
    }
    return body.text;
  }

  #addListToBody(token: ListToken) {
    const slide = this.#slide;
    const { ordered, items } = token;
    let bulletedText = "";
    const bodyText = this.#getBodyText();
    let listOffset = bodyText.text.length;
    let length = 0;
    let localOffset = listOffset;
    const addListItems = (depth: number, items: ListItemToken[]) => {
      items.forEach((item) => {
        const [textToken, listToken] = item.tokens;
        const { text, styles } = this.#parseText(textToken.tokens, localOffset);
        bodyText.text += `${"\t".repeat(depth)}${text}`;
        this.#depthAdjustment += depth;
        localOffset += text.length;
        length += text.length;
        bodyText.styles.push(...styles);
        if (listToken) {
          addListItems(depth + 1, listToken.items);
        }
      });
    };
    addListItems(0, items);
    bodyText.lists.push({ start: listOffset, end: listOffset + length });
  }

  #parseText(tokens: FormattingToken[], current = 0): SlideText {
    let text = "";
    const styles: SlideStyle[] = [];
    const images: number[] = [];
    tokens.forEach((token) => {
      if (token.type === "image") {
        images.push(this.#addImage(token));
        return;
      }
      const { type, text: t } = token;
      const length = t.length;
      text += unescape(t);
      const range = { start: current, end: current + length };
      switch (type) {
        case "strong":
          styles.push({ range, bold: true });
          break;
        case "em":
          styles.push({ range, italic: true });
          break;
        case "del":
          styles.push({ range, strikethrough: true });
          break;
        case "link":
          styles.push({ range, link: token.href });
          break;
      }
      current += length;
    });
    return { text: `${text}\n`, styles, lists: [], images };
  }

  #finalizeSlide() {
    const slide = this.#slide;
    if (!slide) return;
    const hasText = !!slide.body?.at(0)?.text?.text;
    const hasImages = !!slide.body?.at(0)?.text?.images?.length;
    if (slide.subtitle && !hasText) {
      slide.layout = "TITLE";
    } else if (hasText) {
      slide.layout = "TITLE_AND_BODY";
      delete slide.subtitle;
    } else if (!hasImages) {
      slide.layout = "MAIN_POINT";
      slide.body = [];
    }
    this.#depthAdjustment = 0;
  }

  #newSlide() {
    this.#finalizeSlide();
    this.#slides.push({
      objectId: `Slide-${this.#startIndex + this.#slides.length}`,
      layout: "BLANK",
      body: [],
    });
  }

  #addImage(token: ImageToken) {
    const id = this.#images.length;
    this.#images.push(token);
    return id;
  }
}

function slidesToRequests(
  slides: Slide[],
  imageUrls: string[]
): SlidesRequest[] {
  const requests: SlidesRequest[] = [];
  slides.forEach((slide) => {
    const request: SlidesCreateSlideRequest = {
      objectId: slide.objectId,
      slideLayoutReference: { predefinedLayout: slide.layout },
      placeholderIdMappings: mapPlaceholders(slide.objectId, slide.layout),
    };
    requests.push({ createSlide: request });
    if (slide.title) {
      requests.push({
        insertText: {
          text: slide.title.text,
          objectId: `${slide.objectId}-title`,
        },
      });
    }
    if (slide.subtitle) {
      requests.push({
        insertText: {
          text: slide.subtitle.text,
          objectId: `${slide.objectId}-subtitle`,
        },
      });
    }
    slide.body.forEach((body) => {
      const bodyText = body.text;
      if (!bodyText) return;
      if (bodyText.images?.length) {
        requests.push({
          createImage: {
            url: imageUrls[bodyText.images[0]],
            elementProperties: {
              pageObjectId: slide.objectId,
            },
          },
        });
      } else if (bodyText.text) {
        const objectId = `${slide.objectId}-body`;
        requests.push({
          insertText: { text: bodyText.text, objectId },
        });
        bodyText.lists.forEach((list) => {
          requests.push({
            createParagraphBullets: {
              objectId,
              textRange: {
                type: "FIXED_RANGE",
                startIndex: list.start,
                endIndex: list.end,
              },
            },
          });
        });
        bodyText.styles.forEach((style) => {
          requests.push({
            updateTextStyle: {
              objectId,
              ...getTextStyle(style),
              textRange: {
                type: "FIXED_RANGE",
                startIndex: style.range.start,
                endIndex: style.range.end,
              },
            },
          });
        });
      }
    });
  });
  return requests;
}

function getTextStyle(style: SlideStyle): {
  style: SlidesTextStyle;
  fields: string;
} {
  const { link: url, range: _, ...rest } = style;
  const linkStyle = url ? { link: { url } } : {};
  const fields = Object.keys(rest);
  if (url) fields.push("link");

  return { style: { ...linkStyle, ...rest }, fields: fields.join(",") };
}

function mapPlaceholders(slideId: string, layout: SlidesPredefinedLayout) {
  const mappings: SlidesLayoutPlaceholderIdMapping[] = [];
  switch (layout) {
    case "TITLE":
      mappings.push({
        layoutPlaceholder: { type: "CENTERED_TITLE", index: 0 },
        objectId: `${slideId}-title`,
      });
      mappings.push({
        layoutPlaceholder: { type: "SUBTITLE", index: 0 },
        objectId: `${slideId}-subtitle`,
      });
      break;
    case "TITLE_AND_BODY":
      mappings.push({
        layoutPlaceholder: { type: "TITLE", index: 0 },
        objectId: `${slideId}-title`,
      });
      mappings.push({
        layoutPlaceholder: { type: "BODY", index: 0 },
        objectId: `${slideId}-body`,
      });
      break;
    case "MAIN_POINT":
      mappings.push({
        layoutPlaceholder: { type: "TITLE", index: 0 },
        objectId: `${slideId}-title`,
      });
      break;
  }
  return mappings;
}
