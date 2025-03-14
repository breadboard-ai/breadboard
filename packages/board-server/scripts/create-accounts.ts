/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "fs/promises";
import { createAccount } from "./accounts";

type Account = {
  username: string;
  key?: string;
};

if (process.argv.length !== 3) {
  console.error("Usage: create-accounts <filename>");
  process.exit(1);
}

const filename = process.argv[2];

console.log(`Reading accounts from ${filename}...`);
const accounts = await readAccounts(filename);
console.log(`Creating ${accounts.length} accounts...`);
await createAccounts(accounts);

async function readAccounts(filename: string): Promise<Account[]> {
  try {
    const file = await readFile(filename, "utf-8");
    return file
      .trim()
      .split("\n")
      .map((line) => {
        const [username, key] = line.split("\t");
        if (!username) {
          return null;
        }
        return { username, key };
      })
      .filter(Boolean) as Account[];
  } catch (e) {
    console.error(`Error reading file: ${e}`);
    process.exit(1);
  }
}

async function createAccounts(accounts: Account[]) {
  for (const account of accounts) {
    console.log(`Creating account: ${account.username}`);
    try {
      await createAccount(account.username, account.key);
    } catch {
      // Ignore errors
    }
  }
}
