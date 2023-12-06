import { BoardRunner, InputValues, Kit } from '@google-labs/breadboard';
import { watch as fsWatch } from 'fs';
import { loadBoard, parseStdin, resolveFilePath } from './lib/utils.js';

async function runBoard(board: BoardRunner, inputs: InputValues) {
  const kits: Kit[] = [];

  for await (const stop of board.run({ kits })) {
    if (stop.type === "input") {
      stop.inputs = inputs;
    } else if (stop.type === "output") {
      console.log(stop.outputs);
    }
  }
}

export const run = async (file: string, options: Record<string, string>) => {
  if (file != undefined) {
    const input = JSON.parse(options.input) as InputValues;

    const filePath = resolveFilePath(file);
    let board = await loadBoard(filePath);

    // We always have to run the board once.
    await runBoard(board, input);

    // If we are watching, we need to run the board again when the file changes.
    if ('watch' in options) {
      const controller = new AbortController();

      fsWatch(file, { signal: controller.signal }, async (eventType: string, filename: string | Buffer | null) => {
        if (typeof (filename) != 'string') return;

        if (eventType === 'change') {
          // Now the board has changed, we need to reload it and run it again.
          board = await loadBoard(filePath);
          // We might want to clear the console here.
          await runBoard(board, input);
        }
        else if (eventType === 'rename') {
          console.error(`File ${filename} has been renamed. We can't manage this yet. Sorry!`);
          controller.abort();
        }
      });
    }
  }
  else {
    const stdin = await parseStdin();
    const url = URL.createObjectURL(new Blob([stdin], { type: 'application/json' }));

    // We should validate it looks like a board...
    const board = await BoardRunner.fromGraphDescriptor(JSON.parse(stdin));

    await runBoard(board, <InputValues> <unknown> options["input"]);

    URL.revokeObjectURL(url);
  }
}