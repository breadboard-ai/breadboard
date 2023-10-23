HtmlChunker is a library to split web page content into text passages. It uses 
[Beautiful Soup](https://www.crummy.com/software/BeautifulSoup/bs4/doc/) with
[html5lib](https://pypi.org/project/html5lib/) to parse HTML into a DOM tree,
and then combines text from nodes of the DOM tree into passages.

Each passage contains either a single html node of text, or the text of the
node and its siblings and descendants if the total number of words is less
than a configurable maximum. The algorithm starts at the leaf nodes and
attempts to aggregate node texts until the maximum number of words is reached.

## Usage

```
from google_labs_html_chunker.html_chunker import HtmlChunker

html = "<p>Paragraph 1.</p>"
chunker = HtmlChunker(
    max_words_per_aggregate_passage=200,
    greedily_aggregate_sibling_nodes=True,
)
passages = chunker.chunk(html)
```

## Configurations

`max_words_per_aggregate_passage`: Maximum number of words in a passage
comprised of multiple html nodes. A passage with text from only a single html
node may exceed this max.

`greedily_aggregate_sibling_nodes`: If `True`, sibling html nodes are greedily
aggregated into passages under `max_words_per_aggregate_passage` words. If
`False`, each sibling node is output as a separate passage if all siblings
cannot be combined into a single passage under
`max_words_per_aggregate_passage` words.

If you find your passages are too disjointed (insufficient context in a single
passage for your application), consider increasing
`max_words_per_aggregate_passage` and/or setting
`greedily_aggregate_sibling_nodes` to `True`.

## Example Outputs

For all examples, we will use the following input:

```
html = """
    <div>
        <h1>Heading</h1>
        <p>Text before <a>link</a> and after.</p>
    </div>
"""
```

Parsed DOM tree:

```
div
├── h1
│   └── "Heading"
└── p
    ├── "Text before"
    ├── a
    │   └── "link"
    └── "and after."
```

### Example 1

```
chunker = HtmlChunker(
    max_words_per_aggregate_passage=4,
    greedily_aggregate_sibling_nodes=False,
)
passages = chunker.chunk(html)
```

All html nodes are output separately because there are 5 words in the
descendants of the `<p>` node so they cannot all be combined in <=4 words:

passages: ["Heading", "Text before", "link", "and after."]


### Example 2

```
chunker = HtmlChunker(
    max_words_per_aggregate_passage=5,
    greedily_aggregate_sibling_nodes=False,
)
passages = chunker.chunk(html)
```

The children of the `<p>` node can now be combined in <= 5 words:

passages: ["Heading", "Text before link and after."]


### Example 3

```
chunker = HtmlChunker(
    max_words_per_aggregate_passage=6,
    greedily_aggregate_sibling_nodes=False,
)
passages = chunker.chunk(html)
```

Text at the next higher level of the tree can now be included since the total
number of words is <= 6:

passages: ["Heading Text before link and after."]


### Example 4

```
chunker = HtmlChunker(
    max_words_per_aggregate_passage=4,
    greedily_aggregate_sibling_nodes=True,
)
passages = chunker.chunk(html)
```

The sibling children of the `<p>` node are greedily aggregated while the total
is <=4 words:

passages: ["Heading", "Text before link", "and after."]