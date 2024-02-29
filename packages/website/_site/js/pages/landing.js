/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import "../header.js";
import "../footer.js";
let BreadboardSiteLanding = class BreadboardSiteLanding extends LitElement {
    static { this.styles = css `
    main {
      padding: 16px;
    }
  `; }
    render() {
        return html `
      <bb-site-header></bb-site-header>
      <main>
        <p>Welcome to Breadboard!</p>
      </main>
      <bb-site-footer></bb-site-footer>
    `;
    }
};
BreadboardSiteLanding = __decorate([
    customElement("bb-site-landing")
], BreadboardSiteLanding);
export { BreadboardSiteLanding };
//# sourceMappingURL=landing.js.map