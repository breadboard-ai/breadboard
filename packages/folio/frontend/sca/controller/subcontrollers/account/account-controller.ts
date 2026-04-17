/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * The Account Controller for Folio.
 * Handles user information and authentication state.
 */
export class AccountController extends RootController {
  @field()
  accessor name: string = "Maya";

  @field()
  accessor avatar: string = "";

  @field({ deep: false })
  accessor scopes: string[] = ["read", "write"];

  constructor() {
    super("Account", "AccountController");
  }

  async signIn() {
    console.log("Sign in requested");
  }

  async signOut() {
    console.log("Sign out requested");
  }
}
