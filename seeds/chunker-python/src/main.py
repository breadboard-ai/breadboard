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
import argparse
from google_labs_html_chunker.html_chunker import HtmlChunker

# Main function to try out HtmlChunker on a saved html file.
#
# Example usage:
#   python3 main.py -i path/to/input_file.html -o path/to/output_file.txt --maxwords 200 --no-greedyagg

if __name__ == "__main__":
  arg_parser = argparse.ArgumentParser()
  arg_parser.add_argument("-i", "--infile", help="HTML input file path.", required=True)
  arg_parser.add_argument("-o", "--outfile", help="Output passages file path.", required=True)
  arg_parser.add_argument("--maxwords", type=int, default=200, help="Max words per aggregate passage.")
  arg_parser.add_argument("--greedyagg", action=argparse.BooleanOptionalAction, help="Whether to greedily aggregate sibling nodes.")
  arg_parser.add_argument("--excludetags", type=str, default="noscript,script,style", help="Comma-separated HTML tags from which to exclude text.")
  args = arg_parser.parse_args()

  html_file = open(args.infile, "r")
  html = html_file.read()
  html_file.close()

  chunker = HtmlChunker(
      max_words_per_aggregate_passage=args.maxwords,
      greedily_aggregate_sibling_nodes=args.greedyagg,
      html_tags_to_exclude={tag for tag in args.excludetags.split(',')},
  )
  passages = chunker.chunk(html)

  passages_file = open(args.outfile, "w")
  passages_file.writelines(passage + "\n\n" for passage in passages)
  passages_file.close()
