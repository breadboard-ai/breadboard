import { appendFile } from "fs/promises";

export class Logger {
  private filename: string;
  private lines: string[] = [];

  constructor(filename: string) {
    this.filename = filename;
  }

  log(message: string) {
    this.lines.push(message);
  }

  async save() {
    await appendFile(this.filename, this.lines.join("\n"));
  }
}
