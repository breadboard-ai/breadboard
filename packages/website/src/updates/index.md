---
layout: updates.njk
title: Breadboard Updates
isIndex: true
---

These are our semi-regular updates about the state of the project. If you'd like
to keep up with what's happening with Breadboard, this is the page to watch.

<ul>
{%- assign sorted_updates = collections.update | sort: 'date' | reverse -%}
{%- for post in sorted_updates -%}
  <li><a href="/breadboard{{ post.url }}">{{ post.data.title }}</a></li>
{%- endfor -%}
</ul>
