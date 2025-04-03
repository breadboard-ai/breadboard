import { type GeminiOutputs, type GeminiAPIOutputs } from "./gemini";
import { err, toLLMContent, endsWithRole } from "./utils";

export { StructuredResponse };

class StructuredResponse {
  public prolog: string = "";
  public epilog: string = "";
  public body: string = "";
  response: LLMContent | undefined = undefined;

  constructor(
    public readonly id: string,
    public readonly chat: boolean
  ) {}

  get separator() {
    return `<sep-${this.id}>`;
  }

  addPrompt(c: LLMContent[], prompt: LLMContent): LLMContent[] {
    const { parts: p } = prompt;
    const context: LLMContent[] = [...c];
    const parts = [
      {
        text: this.instructionText(),
      },
      ...p,
    ];
    if (endsWithRole(c, "user")) {
      const last = context.pop()!;
      context.push({
        ...last,
        parts: [...last.parts, ...parts],
      });
    } else {
      context.push({ parts, role: "user" });
    }
    return context;
  }

  instructionText(): string {
    const chatOrConclude = this.chat
      ? `Finally, ask the user to provide feedback on your output as a friendly assistant might.`
      : `Finally, you briefly summarize what the work product was and how it fulfills the task.`;

    return `
Consider the conversation context so far and generate a response.

Your response must consist of three parts, separated by the ${this.separator} tag.

- Briefly describe the work product, why it fulfills the specified task,
and any notes or comments you might have about it
- Insert the ${this.separator} tag
- Provide the work product only, without any additional conversation 
or comments about your output
- Insert the ${this.separator} tag
${chatOrConclude}
`;
  }

  instruction(): LLMContent {
    return toLLMContent(this.instructionText());
  }

  parseContent(content: LLMContent): Outcome<void> {
    const part = content.parts?.at(0);
    if (!part || !("text" in part)) {
      return err("No text in part");
    }
    this.response = content;
    const structure = part.text.split(this.separator);
    if (structure.length !== 3) {
      console.warn(
        `The output must contain 3 parts, but ${structure.length} were found`
      );
      if (structure.length > 1) {
        // Assume that the prolog and body are here, but the epilog was gone.
        // This can happen sometimes when we go past the output token window.
        this.prolog = structure[0];
        this.body = structure[1].trim();
        this.epilog = this.chat ? "Please provide feedback" : "";
        return;
      }
      return err(
        `No structure response delimiters were found. This is likely an invalid reponse.`
      );
    }
    this.prolog = structure[0];
    this.body = structure[1].trim();
    this.epilog = structure[2].trim();
  }

  bodyAsContent(): LLMContent {
    return toLLMContent(this.body, "model");
  }

  parse(response: GeminiOutputs): Outcome<void> {
    const r = response as GeminiAPIOutputs;
    const content = r.candidates?.at(0)?.content;
    if (!content) {
      return err("No content");
    }
    return this.parseContent(content);
  }
}
