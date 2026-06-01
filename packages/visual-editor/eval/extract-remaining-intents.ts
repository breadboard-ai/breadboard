import fs from "node:fs";
import path from "node:path";

function parseCSV(content: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  let inQuotes = false;
  let currentField = "";
  let currentRow: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\n" || (char === "\r" && nextChar === "\n")) && !inQuotes) {
      if (char === "\r") i++;
      currentField = currentField.trim();
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        if (currentRow.length === 2) {
          if (currentRow[0] !== "intent" || currentRow[1] !== "breadboard_json") {
            entries.push([currentRow[0] as string, currentRow[1] as string]);
          }
        }
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length === 2) {
      if (currentRow[0] !== "intent" || currentRow[1] !== "breadboard_json") {
        entries.push([currentRow[0] as string, currentRow[1] as string]);
      }
    }
  }

  return entries;
}

interface NoteLocation {
  type: string;
  fieldName: string;
  dimension?: string;
  nodeId?: string;
  turn?: number;
  eventIndex?: number;
}

interface UserNote {
  id: string;
  location: NoteLocation;
  text?: string;
  reaction?: string;
  timestamp: string;
}

interface RunNotes {
  notes: UserNote[];
}

function processRemainingIntents() {
  const inputCsvPath = path.join(process.cwd(), "intents.local.csv");
  const outputCsvPath = path.join(process.cwd(), "intents-remaining.local.csv");
  const outDir = path.join(process.cwd(), "out");

  if (!fs.existsSync(inputCsvPath)) {
    console.error(`Error: Input file not found at ${inputCsvPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(outDir)) {
    console.error(`Error: Output directory not found at ${outDir}`);
    process.exit(1);
  }

  console.log(`Reading intents from: ${inputCsvPath}`);
  const csvContent = fs.readFileSync(inputCsvPath, "utf-8");
  const entries = parseCSV(csvContent);
  console.log(`Successfully parsed ${entries.length} intents.`);

  const outFiles = fs.readdirSync(outDir);
  const remainingEntries: Array<[string, string]> = [];

  for (let i = 0; i < entries.length; i++) {
    const [intent, breadboard_json] = entries[i];
    const evalId = `batch-intent-${String(i + 1).padStart(2, "0")}`;
    
    // Find matching notes.json files for this evalId
    const matchingNotesFiles = outFiles.filter((filename) => 
      filename.includes(`${evalId}-`) && 
      filename.endsWith(".notes.json")
    );

    let includeIntent = false;

    for (const noteFilename of matchingNotesFiles) {
      try {
        const noteFilePath = path.join(outDir, noteFilename);
        const noteContent = fs.readFileSync(noteFilePath, "utf-8");
        const notesObj = JSON.parse(noteContent) as RunNotes;

        if (Array.isArray(notesObj?.notes)) {
          const hasBadOrComment = notesObj.notes.some((note) => {
            if (note.location?.type !== "rater") return false;
            if (note.location?.fieldName !== "overall_judgement") return false;

            const reaction = note.reaction;
            const text = note.text ? note.text.trim() : "";

            const isBad = reaction === "bad";
            const isComment = text !== "" && text !== "Good" && text !== "Bad";

            return isBad || isComment;
          });

          if (hasBadOrComment) {
            includeIntent = true;
            break; // Found matching note for this intent, no need to check other note files for it.
          }
        }
      } catch (err) {
        console.warn(`Warning: Failed to parse notes file '${noteFilename}':`, err);
      }
    }

    if (includeIntent) {
      remainingEntries.push([intent, breadboard_json]);
    }
  }

  console.log(`Filtering complete. Found ${remainingEntries.length} intents meeting criteria.`);

  // Write output CSV
  let outputCsvContent = "intent,breadboard_json\n";
  for (const [intent, breadboard_json] of remainingEntries) {
    const escapedIntent = intent.replace(/"/g, '""');
    const escapedJson = breadboard_json.replace(/"/g, '""');
    outputCsvContent += `"${escapedIntent}","${escapedJson}"\n`;
  }

  fs.writeFileSync(outputCsvPath, outputCsvContent, "utf-8");
  console.log(`Saved remaining intents to: ${outputCsvPath}`);
}

processRemainingIntents();
