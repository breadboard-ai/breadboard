/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { type SemVer, SemanticVersioning } from "../../src/semver.js";

test("SemanticVersioning throws with invalid values", async (t) => {
  t.throws(() => new SemanticVersioning("value" as unknown as SemVer));
});

test("SemanticVersioning defaults to 0.0.1", async (t) => {
  const semver = new SemanticVersioning();
  t.is(semver.version, "0.0.1");
});

test("SemanticVersioning returns versions", async (t) => {
  const semver = new SemanticVersioning("1.2.3");
  t.is(semver.version, "1.2.3");
});

test("SemanticVersioning bumps major", async (t) => {
  const semver = new SemanticVersioning("1.1.1");
  semver.major();
  t.is(semver.version, "2.0.0");
});

test("SemanticVersioning bumps minor", async (t) => {
  const semver = new SemanticVersioning("1.1.1");
  semver.minor();
  t.is(semver.version, "1.2.0");
});

test("SemanticVersioning bumps patch", async (t) => {
  const semver = new SemanticVersioning("1.1.1");
  semver.patch();
  t.is(semver.version, "1.1.2");
});

test("SemanticVersioning rolls over to double digits", async (t) => {
  const semver = new SemanticVersioning("9.1.1");
  semver.major();
  t.is(semver.version, "10.0.0");
});
