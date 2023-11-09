# Copyright 2023 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import bs4

# Text within these html tags will be excluded from passages by default.
_DEFAULT_HTML_TAGS_TO_EXCLUDE = frozenset({"noscript", "script", "style"})

# Html tags that indicate a section break. Sibling nodes will not be
# greedily-aggregated into a chunk across one of these tags.
_SECTION_BREAK_HTML_TAGS = frozenset({
    "article",
    "br",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "footer",
    "header",
    "main",
    "nav",
})


class HtmlChunker:
  """Chunks html documents into text passages.

  Each passage contains either a single html node of text, or the text of the
  node and its siblings and descendants if the total number of words is less
  than max_words_per_aggregate_passage.

  Attributes:
    max_words_per_aggregate_passage: Maximum number of words in a passage
      comprised of multiple html nodes. A passage with text from only a single
      html node may exceed this max.
    greedily_aggregate_sibling_nodes: If true, sibling html nodes are greedily
      aggregated into passages under max_words_per_aggregate_passage words. If
      false, each sibling node is output as a separate passage if they cannot
      all be combined into a single passage under
      max_words_per_aggregate_passage words.
    html_tags_to_exclude: Text within any of the tags in this set will not be
      included in the output passages. Defaults to {"noscript", "script",
      "style"}.
  """

  def __init__(
      self,
      max_words_per_aggregate_passage: int,
      greedily_aggregate_sibling_nodes: bool,
      html_tags_to_exclude: frozenset[str] = _DEFAULT_HTML_TAGS_TO_EXCLUDE,
  ) -> None:
    self.max_words_per_aggregate_passage = max_words_per_aggregate_passage
    self.greedily_aggregate_sibling_nodes = greedily_aggregate_sibling_nodes
    self.html_tags_to_exclude = {
        tag.strip().lower() for tag in html_tags_to_exclude
    }

  class PassageList:
    """A list of text passages."""

    def __init__(self) -> None:
      self.passages: list[str] = []

    def add_passage_for_node(self, node: "HtmlChunker.AggregateNode") -> None:
      """Adds a text passage for the input node."""
      passage = node.create_passage()
      if passage:
        self.passages.append(passage)

    def extend(self, passage_list: "HtmlChunker.PassageList"):
      """Extends this PassageList with the input passage_list."""
      self.passages.extend(passage_list.passages)

  class AggregateNode:
    """Contains aggregate information about a node and its descendants.

    Attributes:
      html_tag: Html tag for this node, or None for text nodes.
      segments: Segments of text that are part of this AggregateNode.
      num_words: Total number of words in the segments of this AggregateNode.
      passage_list: Completed passages for this node and descendant nodes.
    """

    def __init__(self) -> None:
      self.html_tag: str | None = None
      self.segments: list[str] = []
      self.num_words: int = 0
      self.passage_list: HtmlChunker.PassageList = HtmlChunker.PassageList()

    def fits(self, node: "HtmlChunker.AggregateNode", max_words: int) -> bool:
      """Returns true if the input node can be added to this AggregateNode without exceeding max_words."""
      return self.num_words + node.num_words <= max_words

    def add_node(self, node: "HtmlChunker.AggregateNode") -> None:
      """Adds the input node to this AggregateNode."""
      if not node.segments:
        return
      self.num_words += node.num_words
      self.segments.extend(node.segments)

    def create_passage(self) -> str:
      """Creates and returns a text passage for this AggregateNode."""
      self.segments = list(filter(None, self.segments))
      return " ".join(self.segments)

    def get_passages(self) -> list[str]:
      """Returns a list of text passages for this AggregateNode."""
      return self.passage_list.passages

  def _process_node(self, node) -> AggregateNode:
    """Recursively processes a node and its descendants.

    Args:
      node: A node of a BeautifulSoup tree.

    Returns:
      An AggregateNode for this node and its descendants.
    """
    current_node = self.AggregateNode()
    if node.name:
      current_node.html_tag = node.name
    if node.name in self.html_tags_to_exclude or isinstance(node, bs4.Comment):
      # Exclude text within these tags.
      return current_node

    if isinstance(node, bs4.NavigableString):
      # Store the text for this leaf node (skipping text directly under the
      # top-level BeautifulSoup object, e.g. "html" from <!DOCTYPE html>).
      if node.parent.name != "[document]":
        current_node.num_words = len(node.split())
        current_node.segments.append(node.strip())
      return current_node

    # Will hold the aggregate of this node and all its unchunked descendants
    # after we've recursed over all of its children.
    current_aggregating_node = self.AggregateNode()
    # As above, but this holds the current greedy aggregate, which can be reset
    # when starting a new greedy aggregate passage (if the current greedy
    # aggregate is over max words, we hit a section break, or we hit a node that
    # is already part of another passage).
    current_greedy_aggregating_node = self.AggregateNode()
    # Indicates whether we should attempt to aggregate the node being processed
    # in this function with its children. We only attempt to aggregate if we can
    # include all of its descendants in the aggregate.
    should_aggregate_current_node = True
    # Will hold a list of descendant passages that should be added to this
    # current_node.passage_list if we do not end up aggregating the current_node
    # into a passage with its descendants.
    passage_list = HtmlChunker.PassageList()

    for child in node.children:
      child_node = self._process_node(child)
      if child_node.get_passages():
        should_aggregate_current_node = False
        if self.greedily_aggregate_sibling_nodes:
          passage_list.add_passage_for_node(current_greedy_aggregating_node)
          current_greedy_aggregating_node = self.AggregateNode()
        passage_list.extend(child_node.passage_list)
      else:
        current_aggregating_node.add_node(child_node)
        if self.greedily_aggregate_sibling_nodes:
          if (
              child_node.html_tag not in _SECTION_BREAK_HTML_TAGS
              and current_greedy_aggregating_node.fits(
                  child_node, self.max_words_per_aggregate_passage
              )
          ):
            current_greedy_aggregating_node.add_node(child_node)
          else:
            passage_list.add_passage_for_node(current_greedy_aggregating_node)
            current_greedy_aggregating_node = child_node
        else:
          passage_list.add_passage_for_node(child_node)
    if self.greedily_aggregate_sibling_nodes:
      passage_list.add_passage_for_node(current_greedy_aggregating_node)

    # If we should not or cannot aggregate this node, add passages for this node
    # and its descendant passages.
    if not should_aggregate_current_node or not current_node.fits(
        current_aggregating_node, self.max_words_per_aggregate_passage
    ):
      current_node.passage_list.add_passage_for_node(current_node)
      current_node.passage_list.extend(passage_list)
      return current_node

    # Add this node to the aggregate.
    current_node.add_node(current_aggregating_node)
    return current_node

  def chunk(self, html: str) -> list[str]:
    """Chunks the html into text passages.

    Args:
      html: HTML DOM string, e.g. from document.innerHtml.

    Returns:
      A list of text passages from the html.
    """
    tree = bs4.BeautifulSoup(html, "html5lib")
    root_agg_node = self._process_node(tree)
    if not root_agg_node.get_passages():
      root_agg_node.passage_list.add_passage_for_node(root_agg_node)
    return root_agg_node.get_passages()