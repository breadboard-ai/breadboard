/**
 * @fileoverview Marked Types
 */

export type Token =
  | ParagraphToken
  | HeadingToken
  | ListToken
  | ListItemToken
  | HrToken
  | SpaceToken
  | CodeToken
  | CodespanToken
  | EscapeToken
  | BlockquoteToken;

export type FormattingToken =
  | SpaceToken
  | BrToken
  | ImageToken
  | TextToken
  | LinkToken
  | EmToken
  | StrongToken
  | DelToken
  | CodespanToken
  | EscapeToken;

export type RichToken =
  | BlockquoteToken
  | TextToken
  | HeadingToken
  | ParagraphToken
  | ListItemToken;

export type SpaceToken = {
  type: "space";
  raw: string;
};

export type BrToken = {
  type: "br";
  raw: string;
};

export type CodeToken = {
  type: "code";
  raw: string;
  codeblockStyle?: "indented";
  lang?: string;
  text: string;
  excaped?: boolean;
};

export type CodespanToken = {
  type: "codespan";
  raw: string;
  text: string;
};

export type BlockquoteToken = {
  type: "blockquote";
  raw: string;
  text: string;
  tokens: FormattingToken[];
};

export type EscapeToken = {
  type: "escape";
  raw: string;
  text: string;
};

export type ImageToken = {
  type: "image";
  href: string;
  title?: string;
  text: string;
  raw: string;
};

export type TextToken = {
  type: "text";
  text: string;
  raw: string;
  tokens: FormattingToken[];
};

export type LinkToken = {
  type: "link";
  href: string;
  text: string;
  raw: string;
};

export type EmToken = {
  type: "em";
  raw: string;
  text: string;
};

export type DelToken = {
  type: "del";
  raw: string;
  text: string;
};

export type StrongToken = {
  type: "strong";
  raw: string;
  text: string;
};

export type HeadingToken = {
  type: "heading";
  depth: number;
  raw: string;
  text: string;
  tokens: FormattingToken[];
};

export type HrToken = {
  type: "hr";
  raw: string;
  text: string;
};

export type ParagraphToken = {
  type: "paragraph";
  text: string;
  raw: string;
  tokens: FormattingToken[];
};

export type ListToken = {
  type: "list";
  ordered: boolean;
  raw: string;
  items: ListItemToken[];
};

export type ListItemToken = {
  type: "list_item";
  text: string;
  raw: string;
  tokens: [TextToken, ListToken?];
};
