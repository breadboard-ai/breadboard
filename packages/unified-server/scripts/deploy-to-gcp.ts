#!/usr/bin/env npx tsx

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from "node:child_process";
import { argv } from "node:process";

function runCommand(command: string): void {
  console.log(`\n$ ${command}`); // Log the command
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`\nError executing command: ${command}`);
    process.exit(1);
  }
}

function getCommandOutput(command: string): string {
  console.log(`\n$ ${command}`); // Log the command
  try {
    return execSync(command).toString().trim();
  } catch (error) {
    console.error(`\nError executing command to get output: ${command}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  let project = getCommandOutput("gcloud config get-value project");
  const location = getCommandOutput(
    "gcloud config get-value artifacts/location"
  );

  const serviceName = argv[2] || "unified-server";

  // Expected format: KEY1=VALUE1 KEY2=VALUE2 ...
  const dockerBuildArgs: string[] = [];
  for (let i = 3; i < argv.length; i++) {
    if (argv[i].includes("=")) {
      dockerBuildArgs.push(`--build-arg '${argv[i]}'`);
    } else {
      console.warn(
        `Warning: Ignoring argument "${argv[i]}" as it does not follow the KEY=VALUE format for Docker build-args.`
      );
    }
  }
  const buildArgsString = dockerBuildArgs.join(" ");

  // If the project is in an organization, the full project name might be "org:project".
  // The org and project need to be separate path elements in the repo URL.
  // Replace the first colon with a slash.
  project = project.replace(/:/, "/");

  const domain = `${location}-docker.pkg.dev`;
  const imageUrl = `${domain}/${project}/breadboard/${serviceName}`;

  console.log("\n--- Configuration ---");
  console.log(`Project Path: ${project}`);
  console.log(`Location: ${location}`);
  console.log(`Service Name: ${serviceName}`);
  console.log(`Image URL: ${imageUrl}`);
  if (buildArgsString) {
    console.log(`Docker Build Args: ${buildArgsString}`);
  }
  console.log("---------------------\n");

  runCommand(
    `docker build ${buildArgsString} --build-context=breadboard=../.. --tag=${serviceName} .`
  );

  runCommand(`docker tag ${serviceName} ${imageUrl}`);

  runCommand(`docker push ${imageUrl}`);

  runCommand(
    `gcloud run deploy ${serviceName} --image=${imageUrl} --region=${location} --platform=managed --allow-unauthenticated`
  );

  console.log(
    `\n✅ Deployment script for service '${serviceName}' completed successfully!`
  );
  console.log(`   Image pushed to: ${imageUrl}`);
  console.log(`   Deployed to Cloud Run in region: ${location}`);
}

main().catch((error) => {
  console.error("\nAn unexpected error occurred in the main execution:", error);
  process.exit(1);
});
