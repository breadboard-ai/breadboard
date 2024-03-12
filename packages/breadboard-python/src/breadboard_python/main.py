from pydantic import BaseModel, Field
from pydantic.fields import FieldInfo
from pydantic_core import core_schema
from pydantic.json_schema import GetJsonSchemaHandler, JsonSchemaValue
from pydantic._internal._model_construction import ModelMetaclass
from typing import Any, Self, Tuple, TypeAlias

from pydantic import BaseModel
from typing import List, TypeVar, Generic, get_args, Optional, Union, Dict, ClassVar
from jsonref import replace_refs

import inspect
import json_fix

def update_json_schema(json_schema, handler: GetJsonSchemaHandler):
  #json_schema = handler.resolve_ref_schema(json_schema)
  if "allOf" in json_schema:
    if "required" in json_schema:
      json_schema.pop("required")
    if json_schema["allOf"] == [{"properties": [], "type": "object"}]:
      pass
    # TODO: This is hackily replacing allOf with object. Should check if it's an actual SchemaObject.
    json_schema.pop("allOf")
    json_schema["type"] = "object"
  if "required" in json_schema and isinstance(json_schema["required"], list):
    # Update requried based on whether required = True or False
    required = []
    for k, v in json_schema["properties"].items():
      if v.get("required", False):
        required.append(k)
      if "required" in v:
        v.pop("required")
    json_schema.pop("required")
    if required:
      json_schema["required"] = required
  if "properties" in json_schema:
    for k, v in json_schema["properties"].items():
      update_json_schema(v, handler)
  if "properties" in json_schema and not json_schema["properties"]:
    json_schema.pop("properties")
  return json_schema

def update_final_json_schema(json_schema):
  if "anyOf" in json_schema:
    assert "type" not in json_schema, f"Unexpectedly type and anyOf both are in json_schema: {json_schema}"
    types = [x["type"] for x in json_schema["anyOf"]]
    json_schema["type"] = types
    json_schema.pop("anyOf")
  if "properties" in json_schema:
    for k, v in json_schema["properties"].items():
      update_final_json_schema(v)
  return json_schema

class SchemaObject(BaseModel):
  @classmethod
  def __json__(cls):
    # Populate the references, remove definitions.
    output = cls.model_json_schema()
    output = replace_refs(output, lazy_load=False)
    output = update_final_json_schema(output)
    if "$defs" in output:
      output.pop("$defs")
    return output

  @classmethod
  def __get_pydantic_json_schema__(
    cls, core_schema: core_schema.JsonSchema, handler: GetJsonSchemaHandler
  ) -> JsonSchemaValue:
    json_schema = handler(core_schema)
    json_schema = handler.resolve_ref_schema(json_schema)
    if cls == "toolCalls":
      pass
    if cls == "toolCallsOutput":
      pass
    # Remove "title" to make schema look like a normal Object.
    json_schema.pop("title")
    json_schema = update_json_schema(json_schema, handler)
        
    return json_schema
    


class ImportedSchemaObject(SchemaObject):
  additionalProperties: ClassVar[bool] = False
  @classmethod
  def __get_pydantic_json_schema__(
    cls, core_schema: core_schema.JsonSchema, handler: GetJsonSchemaHandler
  ) -> JsonSchemaValue:
    json_schema = handler(core_schema)
    json_schema = handler.resolve_ref_schema(json_schema)
    if cls == "toolCalls":
      pass
    if cls == "toolCallsOutput":
      pass
    # Remove "title" to make schema look like a normal Object.
    json_schema.pop("title")
        
    return json_schema

  

T = TypeVar('T', bound=SchemaObject)
S = TypeVar('S', bound=SchemaObject)

UNINITIALIZED = None

from pydantic import create_model

def _parse_type_str(type: str):
  if type == "string":
    return str
  if type == "boolean":
    return bool
  if type == "object":
    return SchemaObject

def _parse_type(schema):
  if "type" in schema:
    type = schema["type"]
  elif "properties" in schema:
    type = "object"
  elif "items" in schema:
    type = "array"
  else:
    type = "any"
  
  if type == "string":
    return str
  if type == "object":
    raise Exception("Many possibilities for object.")
    #return SchemaObject # This can be any type of SchemaObject.
  if type == "array":
    inner_schema = schema["items"]
    inner_type = _parse_type(inner_schema)
    return List[inner_type]
  if type == "boolean":
    return bool
  if isinstance(type, list):
    types = tuple(_parse_type_str(x) for x in schema["type"])
    return Union[types]
  if type == "any":
    return Any
  return Any

def convert_from_json_to_pydantic(name, schema) -> Tuple[Union[BaseModel, type], Field]:
  if "properties" in schema and "type" in schema and schema["type"] != "object":
    raise Exception(f"Expected type to be object. Got {schema['type']} instead.")

  obj = None
  if "properties" in schema:
    type = "object"

    output = {}
    for k, v in schema["properties"].items():
      output[k] = convert_from_json_to_pydantic(k, v)
    obj = create_model(name, __base__=ImportedSchemaObject, **output)
    if "additionalProperties" in schema:
      obj.additionalProperties = schema["additionalProperties"]
  elif schema.get("type") == "object":
    obj = SchemaObject
  args = {}
  for k, v in schema.items():
    if k != "type" and k != "properties" and k != "items":
      args[k] = v
  return (obj if obj else _parse_type(schema), Field(**args))

class FieldContext(FieldInfo):
  """Wraps FieldInfo and includes the original Board."""
  _context: Optional["Board"]
  inner: FieldInfo
  def __init__(self, field_info: FieldInfo, context):
    self.inner = field_info
    self._context = context

  @property
  def _attributes_set(self):
    return self.inner._attributes_set
  
  def __eq__(self, other):
    if isinstance(other, FieldInfo) and not isinstance(other, FieldContext):
      return self.inner == other
    if isinstance(other, FieldContext):
      return self.inner == other.inner
    return super().__eq__(other)
  
  def __hash__(self):
    key = (self.inner.__hash__, self._context.__hash__)
    return hash(key)
 
  def __getattr__(self, item):
    if hasattr(self.inner, item):
      return getattr(self.inner, item)
    if item in self.inner._attributes_set:
      return self.inner._attributes_set[item]
    if "annotation" in self.inner._attributes_set.keys():
      if isinstance(self.inner._attributes_set['annotation'], ModelMetaclass):
        if item in self.inner._attributes_set['annotation'].model_fields.keys():
          return FieldContext(self.inner._attributes_set['annotation'].model_fields[item], self._context)
    raise AttributeError(item)
  
"""
Contains a blob of things. Some can be initialized, some may not.
Wildcard "*" means everything.
Can be passed in dict (as part of inputs/outputs), Board, Tuple, and ModelMetaclass (representing schema field)
"""
class AttrDict(dict):
  _id = None
  def __init__(self, *args, **kwargs):
    for arg in args:
      # TODO: Handle multiple wildcard matches.
      kwargs = kwargs | {"*": arg}
    for k, v in kwargs.items():
      if isinstance(v, FieldInfo):
        # instantiate a new AttrDict
        #v = FieldContext(v)
        pass
        # TODO: Populate the other field info into the AttrDict.
      self[k] = v
  def __setattr__(self, key, value):
    if key == "_id":
      return super().__setattr__(key, value)
    self[key] = value

  def get_or_assign_id(self, default_name = None, required=False):
    if self._id is not None:
      return self._id
    if required:
      raise Exception(f"Id should be assigned but is not: {self}")
    if default_name is not None:
      self._id = default_name
    else:
      # TODO: Fix shared incrementer. It should be tracked based on context.
      self._id = f"{self.__type}-{__class__.SHARED_INDEX}"
      __class__.SHARED_INDEX += 1
    return self._id

  def __contains__(self, item):
    if item == "*":
      return True
    if super().__contains__(item):
      return True
    if super().__contains__("*") and isinstance(self["*"], dict):
      return item in self["*"]

  def __getattr__(self, item):
    if item == "_id":
      return super().__getattr__(item)
    if item not in self:
      return UNINITIALIZED
    return self[item]
  
  def __getitem__(self, item):
    if not super().__contains__(item):
      return super().__getitem__("*")[item]
    return super().__getitem__(item)
  
  def __call__(self, **kwargs):
    for k, v in kwargs.items():
      self[k] = v
    return self

  def __hash__(self):
    return hash(frozenset(self))
  
def resolve_dict(d):
  try:
    if "*" in d and isinstance(d["*"], dict):
      return d | d["*"]
  except KeyError:
    return d
  return d

def get_field_name(field: FieldInfo, blob):
  """Looks for the field in the blob. If not, checks if field already contains it."""
  for k, v in resolve_dict(blob).items():
    if type(v) == tuple and v[0] == field:
      return k
    if isinstance(v, FieldContext) and v.inner == field:
      return k
    if v == field:
      return k
    if isinstance(v, FieldInfo) and "annotation" in v._attributes_set:
      if isinstance(v._attributes_set["annotation"], ModelMetaclass):
        try:
          return get_field_name(field, v._attributes_set["annotation"].model_fields)
        except Exception:
          pass
  # TODO: FOr wildcard matching, just look for name in fieldinfo.
  if "name" in field._attributes_set:
    return field._attributes_set["name"]
  raise Exception(f"Can't find {field}")
  

# input schema is either a modelmetaclass or dict
SchemaType = Union[SchemaObject, Dict]

"""
A Board can have inputs and outputs.
When passed as a parameter, it gives outputs.
"""
class Board(Generic[T, S]):
  title = ""
  description = ""
  version = ""

  type = "unknown-board"

  SHARED_INDEX = {}
  output = {}
  components = {}
  input_board: Optional[Self] = None
  output_board: Optional[Self] = None

  # This is only used within the context of the parent of this Board, if there is one.
  # If there is no parent, this identifier is not used.
  # If None, it is not explicitly set yet. In this case, it will default to the attribute field name
  # it got assigned to.
  # Id should be unique for all components in a parent Board.
  id: Optional[str]


  def _get_schema(self) -> Tuple[SchemaType, SchemaType]:
    # Get input/output schema from typing
    if type(self).__orig_bases__[0].__origin__ == Generic:
      # This means that the Board is still generic and has no input/output schema defined.
      input_schema = Any
      output_schema = Any
      #raise Exception("Board does not have input and output schemas defined.")
    else:
      input_schema, output_schema = get_args(type(self).__orig_bases__[0])

    if not isinstance(input_schema, type) and not isinstance(input_schema, SchemaObject):
      raise Exception(f"Invalid type for schema input: {type(input_schema)}")
    if not isinstance(output_schema, type) and not isinstance(output_schema, SchemaObject):
      raise Exception(f"Invalid type for schema output: {type(output_schema)}")
    return input_schema, output_schema


  def __init__(self, **kwargs) -> None:
    self.input_schema, self.output_schema = self._get_schema()
    self.components = {}
    # For the highest level Board, inputs will always just be the input schemas.
    # For the second-level Boards, inputs will be replaced with values or other edges.
    # Static values should be on init. Calling should be reserved for edges.
    self.inputs: Dict[str, Tuple[Optional[Any], List[Union[FieldContext, Dict, Board]]]] = {}
    self.input_fields = {}
    self.set_inputs: Dict[str, Any] = {"*": []}
    self.id = None
    self.loaded = False
    self.input_board = None
    self.output_board = None

    for k, v in kwargs.items():
      if k == "id":
        self.id = v
        continue
      if isinstance(v, FieldInfo) or isinstance(v, Board) or isinstance(v, AttrDict): # If it's not static
        if k not in self.set_inputs:
          self.set_inputs[k] = []
        self.set_inputs[k].append(v)
      else:
        self.inputs[k] = v

    if self.input_schema and isinstance(self.input_schema, ModelMetaclass):
      for k, v in self.input_schema.model_fields.items():
        if isinstance(v, FieldInfo):
          v = FieldContext(v, self)
        else:
          raise Exception("Unexpected model_field. No FieldInfo")
        if k not in self.inputs:
          self.inputs[k] = v
          # If k is already populated in the input, no need to populate it now.

    self.output = AttrDict()
    if self.output_schema and isinstance(self.output_schema, ModelMetaclass):
      for k, v in self.output_schema.model_fields.items():
        if isinstance(v, FieldInfo):
          v = FieldContext(v, self)
        else:
          raise Exception("Unexpected model_field. No FieldInfo")
        self.output[k] = v
      #self.output = AttrDict(self.output_schema.model_fields)

  def __setattr__(self, name, value):
    super().__setattr__(name, value)
    if hasattr(self, "components") and name in self.components:
      self.components.pop(name)
    if isinstance(value, Board):
      self.components[name] = value
    
    super().__setattr__("loaded", False)

  def __delattr__(self, name: str) -> None:
    super().__delattr__(name)
    if name in self.components:
      self.components.pop(name)

    self.loaded = False

  def __getattr__(self, name):
    if name in self.output:
      v = self.output[name]
    elif "*" in self.output: # when this Board outputs wildcard.
      v = FieldContext(FieldInfo(name=name), self)
    else:
      raise AttributeError(f"Unable to find attribute `{name}` in {self}")
    if isinstance(v, FieldInfo) and not isinstance(v, FieldContext):
      return FieldContext(v, self)
    return v
  
  def finalize(self):
    raise Exception("Not implemented yet")
    
  def get_configuration(self):
    # Filter out anything that's not a reference to another Board, field, or AttrDict.
    # get resolved inputs
    config = {k: v  for k, v in self._get_resolved_inputs().items() if not isinstance(v, FieldContext) and not isinstance(v, Board) and not isinstance(v, dict)}
    if self.input_schema and isinstance(self.input_schema, ModelMetaclass):
      if "schema" in config:
        raise Exception(f"Already have 'schema' key populated in config. This is a reserved field name. Config: {config}")
      config["schema"] = self.input_schema.__json__()
    for k, v in config.items():
      if inspect.isclass(v):
        if issubclass(v, Board):
          v = v()
          blob = v.__json__()
          config[k] = {"board": blob, "kind": "board"}
    return config
  
  def get_or_assign_id(self, default_name = None, required=False):
    if self.id is not None:
      return self.id
    if required:
      raise Exception(f"Id should be assigned but is not: {self}")
    if default_name is not None:
      self.id = default_name
    else:
      # TODO: Fix shared incrementer. It should be tracked based on context.
      if self.type not in __class__.SHARED_INDEX:
        __class__.SHARED_INDEX[self.type] = 1
      self.id = f"{self.type}-{__class__.SHARED_INDEX[self.type]}"
      __class__.SHARED_INDEX[self.type] += 1
    return self.id
  
  def get_or_create_input_output_nodes(self) -> Tuple[Self, Self]:
    if self.input_board is not None:
      return self.input_board, self.output_board
    
    # Populate input node.
    class InputBoard(Board[self.input_schema, self.input_schema]):
      type = "input"
    
    self.input_board = InputBoard()
    self.input_board.get_or_assign_id("input")
    class OutputBoard(Board[self.output_schema, Any]):
      type = "output"

    self.output_board = OutputBoard()
    self.output_board.get_or_assign_id("output")

    return self.input_board, self.output_board
  
  def get_all_components(self) -> List[Self]:
    # This can only be ran after describe is called.
    all_nodes = []

    _input_board, output_board = self.get_or_create_input_output_nodes()
    all_components = [(k, v) for k, v in self.components.items()] + [(output_board.get_or_assign_id(required=True), output_board)]

    # Component can be a Board or an AttrDict.
    already_visited_nodes = set()
    def iterate_component(name, component, assign_name=True) -> List[Dict]:
      nodes = []
      if component == self:
        raise Exception("why")
      if isinstance(component, Board):
        if component in already_visited_nodes:
          return nodes
        already_visited_nodes.add(component)
        inputs = component.set_inputs
        component.get_or_assign_id(name) if name != "*" and assign_name else component.get_or_assign_id(),
        nodes.append(component)

      elif isinstance(component, AttrDict):
        inputs = component
      elif isinstance(component, FieldContext):
        nodes.extend(iterate_component(component._context.id, component._context))
        return nodes
      else:
        raise Exception("Unexpected component type.")
      for k, vs in inputs.items():
        for v in vs:
          if isinstance(v, Board):
            nodes.extend(iterate_component(k, v, assign_name=False))
          elif isinstance(v, AttrDict):
            nodes.extend(iterate_component(k, v, assign_name=False))
          elif isinstance(v, FieldContext):
            nodes.extend(iterate_component(k, v._context, assign_name=False))
      return nodes

    for name, component in all_components:
      all_nodes.extend(iterate_component(name, component))

    return all_nodes

  def __json__(self):
    output = {}
    if self.title is not None:
      output["title"] = self.title
    if self.description is not None:
      output["description"] = self.description
    if self.version is not None:
      output["version"] = self.version
    # TODO: Find out what graphs are.
    output["graphs"] = {}
    output["nodes"] = []

    # When constructing the graph, two adhoc Boards are added, representing input and output.
    input_board, output_board = self.get_or_create_input_output_nodes()
    self.describe(input_board, output_board)

    kits = set()
    all_nodes = []

    all_nodes = self.get_all_components()

    # Generate nodes
    for component in all_nodes:
      inputs = component.set_inputs
      node = {
        # Assign type if is dependency. Assign name if is the Board.
        "id": component.get_or_assign_id(required=True),
        "type": component.type,
        "configuration": component.get_configuration(),
      }
      output["nodes"].append(node)

      # check for kit
      package_name = getattr(component, "_package_name", None)
      if package_name:
        kits.add(package_name)


    replace_mapping = {}
    """
    initial_all_nodes = [x for x in all_nodes]
    all_nodes = set(all_nodes)
    for each_component in initial_all_nodes:
      class InputBoard(Board[each_component.input_schema, each_component.input_schema]):
        type = "input"
      
      input_component = InputBoard()
      input_component.get_or_assign_id(f"{each_component.get_or_assign_id(required=True)}-input")
      class OutputBoard(Board[each_component.output_schema, each_component.output_schema]):
        type = "output"

      output_component = OutputBoard()
      output_component.get_or_assign_id(f"{each_component.get_or_assign_id(required=True)}-output")
      each_component.describe(input_component, output_component)
      all_nodes.update([input_component, output_component] + each_component.get_all_components())
      replace_mapping[each_component] = output_component
      if each_component in all_nodes:
        all_nodes.remove(each_component)
    """

    # Populate Edges
    output["edges"] = []

    all_edges = []
    for n in all_nodes:
      inputs = n.set_inputs
      for k, vs in inputs.items():
        for v in vs:
          if v in replace_mapping:
            v = replace_mapping[v]
          if isinstance(v, Board):
            edge = {
              "from": v.get_or_assign_id(required=True),
              "to": n.get_or_assign_id(required=True),
              "out": k,
              "in": "" if k == "*" else k,
            }
            all_edges.append(edge)
          elif isinstance(v, FieldContext):
            edge = {
              "from": v._context.get_or_assign_id(required=True),
              # TODO: This is a hacky way to determine node id. AttrDict should be assigned the id.
              "to": n.get_or_assign_id(required=True),
              "out": get_field_name(v, v._context.output),
              "in": k,
              }
            all_edges.append(edge)
          elif isinstance(v, AttrDict):
            # When does an AttrDict happen? It's a nested thing... but sometimes it should be done
            edge = {
              "from": v.get_or_assign_id(required=True),
              # TODO: This is a hacky way to determine node id. AttrDict should be assigned the id.
              "to": n.get_or_assign_id(required=True),
              "out": k,
              "in": "" if k == "*" else k,
            }
            all_edges.append(edge)
          else:
            raise Exception("Unexpected type")

    output["edges"] = all_edges
    
    # Populate Kits
    output["kits"] = [{"url": f"npm:{x}"} for x in kits]
    return output
  
  def _get_resolved_inputs(self):
    resolved_inputs = {}
    for k, v in self.inputs.items():
      if k != "*":
        resolved_inputs[k] = v
      elif isinstance(v, Board):
        resolved_inputs[k] = v
      else:
        resolved_inputs = resolved_inputs | v
    return resolved_inputs
  
  def __call__(self, *args, **kwargs) -> S:
    # TODO: For every input passed in, it's possible to have multiple sources of it.
    # For instance, a Board can be initialized with a certain value for field1, then get it updated by another Board.
    # In this case, we need to store every source of the value.
    # One question is: why do I need to call describe here?
    # Is it just to have the inputs percolate through? But we have no idea if it is used or not, unless it's defined in Python.
    # We should just connect the edges right here.
    # There should only be one static input per input field. That ends being in the config.,
    # There can be many other types of inputs

    # we can take in: Board, dict, or Schema. A Board has a Schema, that is populated

    for k, v in kwargs.items():
      if k in self.inputs and not isinstance(v, FieldContext):
        raise Exception(f"Already got an input field")
      if not isinstance(v, FieldContext) and not isinstance(v, Board):
        raise Exception(f"Only edges can be passed into __call__: {v}")
    
    for k, v in kwargs.items():
      if k not in self.set_inputs:
        self.set_inputs[k] = []
      self.set_inputs[k].append(v)
    # Arg should be treated as dicts
    # TODO: When passed in a whole arg, it should be wildcarded.
        
    # TODO: Support multiple wildcard edges.
    for arg in args:
      if isinstance(arg, dict):
        self.set_inputs["*"].append(arg)
      elif isinstance(arg, SchemaObject):
        self.set_inputs["*"].append(arg.model_fields)
      elif isinstance(arg, Board):
        self.set_inputs["*"].append(arg)
      else:
        raise Exception("Unexpected type for arg")
    
    self.loaded = False
    return self

  @staticmethod
  def load(data: str) -> S:
    pass
  def describe(self, input: T, output: S) -> S:
    pass




