/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {expect} from '@esm-bundle/chai';
import {MyComponent} from '../component.js';

describe('my-component', () => {
  it('is an HTMLElement', () => {
    const c = new MyComponent();
    expect(c).instanceOf(HTMLElement);
  });
});
