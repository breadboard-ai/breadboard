from enum import Enum
from dataclasses import dataclass
import json
import aiohttp
from urllib.parse import urlparse
import aiofiles
from typing import Awaitable, Dict, List, Optional, Tuple
from traversal.traversal_types import (
  GraphDescriptor,
  SubGraphs,
)

class BoardLoaderType(Enum):
  FILE = "file"
  FETCH = "fetch"
  HASH = "hash"
  UNKNOWN = "unknown"

BoardLoaders = Dict[
  BoardLoaderType,
  Awaitable[str],
]

@dataclass
class ResolverResult():
  type: BoardLoaderType
  location: str
  href: str

def resolveURL (
  base: str,
  urlString: str,
  results: List[ResolverResult],
) -> bool:
  url = base + urlString
  url_tuple = urlparse(url)
  hash = url_tuple.fragment
  href = url
  path = url_tuple.netloc + url_tuple.path if url_tuple.scheme == "file" else None
  baseWithoutHash = base.replace(urlparse(base).fragment, "")
  hrefWithoutHash = href.replace(hash, "")
  if baseWithoutHash == hrefWithoutHash and hash:
    results.append(ResolverResult(type="hash", location=hash.substring(1), href=href))
    return True
  if path:
    result = ResolverResult(type="file", location=path, href=href)
  elif href:
    result = ResolverResult(type="fetch", location=hrefWithoutHash, href=href)
  else:
    result = ResolverResult(type="unknown", location="", href=href)
  results.append(result)
  return not hash

async def loadFromFile(path: str):
  async with aiofiles.open(path, 'r') as handle:
    data = await handle.read()
  return json.loads(data)

async def loadWithFetch(url: str):
  async with aiohttp.ClientSession() as session:
    async with session.get(url) as resp:
      return await resp.json()

class BoardLoadingStep():
  loaders: BoardLoaders
  graphs: Optional[SubGraphs] = None

  def __init__(self, graphs: Optional[SubGraphs] = None):
    async def get_hash(hash: str):
      if not graphs:
        raise Exception("No sub-graphs to load from")
      return graphs[hash]
    async def get_unknown(_x):
      raise Exception("Unable to determine Board loader type")
    self.loaders = {
      "file": loadFromFile,
      "fetch": loadWithFetch,
      "hash": get_hash,
      "unknown": get_unknown,
    }

  async def load(self, result: ResolverResult) -> GraphDescriptor:
    graph = await self.loaders[result.type](result.location)
    graph["url"] = result.href
    return graph

class BoardLoader():
  _base: str
  _graphs: Optional[SubGraphs] = None

  def __init__(self, url: str, graphs: Optional[SubGraphs] = None):
    self._base = url
    self._graphs = graphs

  async def load(self, urlString: str) -> Tuple[GraphDescriptor, bool]:
    results = []
    base = self._base
    while not resolveURL(base, urlString, results):
      base = results[results.length - 1].href
    graph = None
    subgraphs = self._graphs
    isSubgraph = True
    for result in results:
      if result.type == "file" or result.type == "fetch":
        isSubgraph = False
      step = BoardLoadingStep(subgraphs)
      graph = await step.load(result)
      subgraphs = graph.get("graphs")
    if not graph:
      raise Exception(
        "BoardLoader failed to load a graph. This error likely indicates a bug in the BoardLoader."
      )
    return graph, isSubgraph
