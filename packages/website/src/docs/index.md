---
layout: docs.njk
title: Breadboard Docs
tags:
  - wip
hide_toc: true
date: 2012-01-01 # Done to place the index atop the list.
---

These are the docs for Breadboard.

<h2>General</h2>
<ul>
{%- for item in collections.general -%}
  <li>
    {% if page.url != item.url %}
      <a href="/breadboard{{ item.url }}">
    {% endif %}

      {{ item.data.title }}

    {% if page.url != item.url %}
      </a>
    {% endif %}
    </li>

{%- endfor -%}

</ul>

<h2>API</h2>
<ul>
{%- for item in collections.api -%}
  <li>
    {% if page.url != item.url %}
      <a href="/breadboard{{ item.url }}">
    {% endif %}

      {{ item.data.title }}

    {% if page.url != item.url %}
      </a>
    {% endif %}
    </li>

{%- endfor -%}

</ul>

<h2>Kits</h2>
<ul>
{%- for item in collections.kits -%}
  <li>
    {% if page.url != item.url %}
      <a href="/breadboard{{ item.url }}">
    {% endif %}

      {{ item.data.title }}

    {% if page.url != item.url %}
      </a>
    {% endif %}
    </li>

{%- endfor -%}

</ul>
