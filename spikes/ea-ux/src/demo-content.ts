/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Demo content — a hardcoded "dinner planner" projection.
 * This is the static content that fills the projection surface.
 * All circable elements get data-circable attributes.
 */
export { renderDemoContent };

function renderDemoContent(container: HTMLElement): void {
  container.innerHTML = `
    <div class="demo-header">
      <h1>Saturday Dinner — 8 Guests</h1>
      <p>Autumn harvest theme · Casual · Budget $180</p>
    </div>

    <div class="demo-grid">
      <div class="circable" data-circable="appetizer" data-label="Appetizer">
        <div class="card-label">Starter</div>
        <div class="card-title">Roasted Butternut Squash Soup</div>
        <div class="card-detail">
          Silky smooth with a swirl of crème fraîche and toasted pepitas.
          Can be made ahead and reheated.
        </div>
        <div class="card-tags">
          <span class="tag">Vegetarian</span>
          <span class="tag warm">30 min</span>
        </div>
      </div>

      <div class="circable" data-circable="main" data-label="Main Course">
        <div class="card-label">Main</div>
        <div class="card-title">Herb-Crusted Rack of Lamb</div>
        <div class="card-detail">
          Dijon and rosemary crust, served with roasted root vegetables
          and a red wine reduction.
        </div>
        <div class="card-tags">
          <span class="tag warm">1 hr 15 min</span>
          <span class="tag">Dairy-free option</span>
        </div>
      </div>

      <div class="circable" data-circable="side" data-label="Side Dish">
        <div class="card-label">Side</div>
        <div class="card-title">Wild Mushroom Risotto</div>
        <div class="card-detail">
          Arborio rice with a mix of chanterelles, porcini, and shiitake.
          Finished with aged parmesan.
        </div>
        <div class="card-tags">
          <span class="tag">Contains dairy</span>
          <span class="tag warm">45 min</span>
        </div>
      </div>

      <div class="circable" data-circable="dessert" data-label="Dessert">
        <div class="card-label">Dessert</div>
        <div class="card-title">Spiced Pear Tarte Tatin</div>
        <div class="card-detail">
          Caramelized pears with star anise and cardamom on flaky puff pastry.
          Served with vanilla bean ice cream.
        </div>
        <div class="card-tags">
          <span class="tag success">Make ahead</span>
          <span class="tag warm">50 min</span>
        </div>
      </div>
    </div>

    <div class="demo-full">
      <div class="circable" data-circable="timeline" data-label="Cooking Timeline">
        <div class="card-label">Day-of Timeline</div>
        <div class="timeline">
          <span class="timeline-time">2:00 PM</span>
          <span class="timeline-dot success"></span>
          <span class="timeline-text">Prep pear tarte tatin, refrigerate</span>
        </div>
        <div class="timeline">
          <span class="timeline-time">3:30 PM</span>
          <span class="timeline-dot"></span>
          <span class="timeline-text">Start butternut squash soup</span>
        </div>
        <div class="timeline">
          <span class="timeline-time">4:30 PM</span>
          <span class="timeline-dot"></span>
          <span class="timeline-text">Prep lamb — apply herb crust, rest at room temp</span>
        </div>
        <div class="timeline">
          <span class="timeline-time">5:15 PM</span>
          <span class="timeline-dot warm"></span>
          <span class="timeline-text">Begin risotto base, prep mushrooms</span>
        </div>
        <div class="timeline">
          <span class="timeline-time">5:45 PM</span>
          <span class="timeline-dot warm"></span>
          <span class="timeline-text">Lamb into oven · Roast root vegetables</span>
        </div>
        <div class="timeline">
          <span class="timeline-time">6:30 PM</span>
          <span class="timeline-dot success"></span>
          <span class="timeline-text">Bake tarte tatin · Finish risotto</span>
        </div>
        <div class="timeline">
          <span class="timeline-time">7:00 PM</span>
          <span class="timeline-dot" style="background: var(--text)"></span>
          <span class="timeline-text">Guests arrive · Serve soup</span>
        </div>
      </div>
    </div>
  `;
}
