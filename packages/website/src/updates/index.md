---
layout: updates.njk
title: Breadboard Updates
isIndex: true
---

Intro

<h2>Recent posts</h2>
<ul>
{%- for post in collections.update -%}
  <li><a href="/breadboard{{ post.url }}">{{ post.data.title }}</a></li>
{%- endfor -%}
</ul>
