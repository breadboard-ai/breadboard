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
from absl.testing import absltest
from absl.testing import parameterized
import sys
sys.path.append("..")
from src.google_labs_html_chunker.html_chunker import HtmlChunker


class HtmlChunkerTest(parameterized.TestCase):

  def test_chunks_single_text_block(self):
    html = "<p>Here is a paragraph.</p>"

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=10,
        greedily_aggregate_sibling_nodes=False,
    )

    self.assertEqual(
        chunker.chunk(html),
        ["Here is a paragraph."],
    )

  def test_handles_escape_codes(self):
    html = "<p>Here&#39;s a paragraph.</p>"

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=10,
        greedily_aggregate_sibling_nodes=False,
    )

    self.assertEqual(
        chunker.chunk(html),
        ["Here's a paragraph."],
    )

  def test_strips_whitespace_around_node_text(self):
    html = """
      <div>
        <p>     \tHere is a paragraph.\nAnd another.\n

        </p>
        <p>\t\n

        </p>
        <p>And more.
        </p>
      </div>
    """

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=10,
        greedily_aggregate_sibling_nodes=False,
    )

    self.assertEqual(
        chunker.chunk(html), ["Here is a paragraph.\nAnd another. And more."]
    )

  def test_handles_empty_dom_elements(self):
    html = "<div><p></p></div>"

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=10,
        greedily_aggregate_sibling_nodes=False,
    )

    self.assertEmpty(chunker.chunk(html))

  def test_chunks_multiple_html_blocks(self):
    html = """
      <div>
        <div>First level one.
          <div>Second level one.
            <div>
              <p>Third level one.</p><p>Third level two.</p>
              <span>Third level three.</span>
            </div>
          </div>
        </div>
        <div>First level two.
        </div>
      </div>
    """

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=10,
        greedily_aggregate_sibling_nodes=False,
    )

    self.assertEqual(
        chunker.chunk(html),
        [
            "First level one.",
            "Second level one.",
            "Third level one. Third level two. Third level three.",
            "First level two.",
        ],
    )

  def test_includes_nodes_over_max_aggregate_chunk_size(self):
    # Same HTML as test_chunks_multiple_html_blocks, except with one long node.
    html = """
      <div>
        <div>First level one.
          <div>Second level one.
            <div>
              <p>Third level one.</p><p>Third level two.</p>
              <span>Third level three but now it's over the max aggregate chunk size alone.</span>
            </div>
          </div>
        </div>
        <div>First level two.
        </div>
      </div>
    """

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=10,
        greedily_aggregate_sibling_nodes=False,
    )

    self.assertEqual(
        chunker.chunk(html),
        [
            "First level one.",
            "Second level one.",
            "Third level one.",
            "Third level two.",
            (
                "Third level three but now it's over the max aggregate chunk"
                " size alone."
            ),
            "First level two.",
        ],
    )

  def test_joins_split_text_nodes_within_p_tag(self):
    html = """
      <p>Paragraph one with
          <a>link</a>
          and more.
      </p>
    """

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=10,
        greedily_aggregate_sibling_nodes=False,
    )

    self.assertEqual(
        chunker.chunk(html),
        [
            "Paragraph one with link and more.",
        ],
    )

  def test_does_not_join_split_text_nodes_within_p_tag_when_over_max(self):
    html = """
      <p>Paragraph one with
          <a>link</a>
          and more.
      </p>
    """

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=1,
        greedily_aggregate_sibling_nodes=False,
    )

    self.assertEqual(
        chunker.chunk(html),
        [
            "Paragraph one with",
            "link",
            "and more.",
        ],
    )

  def test_skips_non_content_text(self):
    html = """
      <head>
        <title>Title</title>
        <style>.my-tag{display:none}</style>
      <head>
      <body>
        <script type="application/json">{"@context":"https://schema.org"}</script>
        <p><!-- A comment -->Paragraph</p>
      </body>
    """

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=10,
        greedily_aggregate_sibling_nodes=False,
    )

    self.assertEqual(
        chunker.chunk(html),
        [
            "Title Paragraph",
        ],
    )

  def test_greedily_aggregates_sibling_nodes(self):
    html = """
      <div>
        <div>First level one.
          <div>Second level one.
            <div>
              <p>Third level one.</p>
              <p>Third level two.</p>
              <p>Third level three.
                <span>Fourth level one.</span>
              </p>
              <span>Third level four that's over the max aggregate chunk size alone.</span>
              <p>Third level five.</p>
              <p>Third level six.</p>
            </div>
          </div>
        </div>
        <div>First level two.
          <div>
            <p>Second level two that should be output alone.
            <p>Second level three.
          </div>
        </div>
      </div>
    """

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=10,
        greedily_aggregate_sibling_nodes=True,
    )

    self.assertEqual(
        chunker.chunk(html),
        [
            "First level one.",
            "Second level one.",
            "Third level one. Third level two.",
            "Third level three. Fourth level one.",
            "Third level four that's over the max aggregate chunk size alone.",
            "Third level five. Third level six.",
            "First level two.",
            "Second level two that should be output alone.",
            "Second level three.",
        ],
    )

  def test_does_not_greedily_aggregate_across_section_breaks(self):
    # The first div should all be combined into a single passage since under
    # max words. The second div is over max words so should be split, and
    # because of the <h2> tag, "Header two" should not be greedily combined with
    # "Paragraph three" and instead combines with "Paragraph four". The third
    # div is the same as the second except the header is changed to a paragraph,
    # allowing it ("Paragraph six") to be combined with "Paragraph five".
    html = """
      <div>
        <p>Paragraph one with
          <a>link</a>
          and more.
        </p>
        <h2>Header one</h2>
        <p>Paragraph two.
      </div>
      <div>
        <p>Paragraph three with
          <a>link</a>
          and more.
        </p>
        <h2>Header two</h2>
        <p>Paragraph four that puts entire div over length.</p>
      </div>
      <div>
        <p>Paragraph five with
          <a>link</a>
          and more.
        </p>
        <p>Paragraph six.</p>
        <p>Paragraph seven that puts entire div over length.</p>
      </div>
    """

    chunker = HtmlChunker(
        max_words_per_aggregate_passage=10,
        greedily_aggregate_sibling_nodes=True,
    )

    self.assertEqual(
        chunker.chunk(html),
        [
            "Paragraph one with link and more. Header one Paragraph two.",
            "Paragraph three with link and more.",
            "Header two Paragraph four that puts entire div over length.",
            "Paragraph five with link and more. Paragraph six.",
            "Paragraph seven that puts entire div over length.",
        ],
    )


if __name__ == "__main__":
  absltest.main()
