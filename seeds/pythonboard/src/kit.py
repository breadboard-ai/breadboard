from typing import List, Optional
from traversal.traversal_types import (
  KitDescriptor, NodeHandlers
)
from javascript import require
from breadboard_types import (
  Kit,
  KitConstructor,
  NodeFactory,
)

def urlToNpmSpec(url: str) -> str:
  if "npm:" not in url:
    raise Exception('URL protocol must be "npm:"')
  return url[4:]

class KitLoader():
  _kits: List[KitDescriptor]
  def __init__(self, kits: Optional[List[KitDescriptor]] = None):
    self._kits = kits or []

  async def load(self) -> KitConstructor:
    kit_constructors = []
    for kit in self._kits:
      # TODO: Support `using` property.
      url = kit["url"]
      # TODO: Support protocols other than `npm:`.
      if (url == "."):
        return None
      spec = urlToNpmSpec(url)
      kit_constructor = require(spec)
      # TODO: Check to see if this import is actually a Kit class.
      kit_constructors.append(kit_constructor)
    return kit_constructors