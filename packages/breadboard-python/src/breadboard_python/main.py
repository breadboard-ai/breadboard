from pydantic import BaseModel, Field
from pydantic.fields import FieldInfo
from pydantic_core import core_schema
from pydantic.json_schema import GetJsonSchemaHandler, JsonSchemaValue
from pydantic._internal._model_construction import ModelMetaclass
from typing import Any, Self, Tuple, TypeAlias

from pydantic import BaseModel
from typing import List, TypeVar, Generic, get_args, Optional, Union, Dict
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
    print("hi")
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
  print(f"WARNING: unknown type: {schema}")
  raise Exception(f"Unsupported type for schema: {schema}")

def convert_from_json_to_pydantic(name, schema):
  # 
  if "properties" in schema and "type" in schema and schema["type"] != "object":
    raise Exception(f"Expected type to be object. Got {schema['type']} instead.")

  obj = None
  if "properties" in schema:
    type = "object"

    output = {}
    for k, v in schema["properties"].items():
      output[k] = convert_from_json_to_pydantic(k, v)
    obj = create_model(name, __base__=ImportedSchemaObject, **output)
  elif schema.get("type") == "object":
    obj = SchemaObject
  args = {}
  for k, v in schema.items():
    if k != "type" and k != "properties" and k != "items":
      args[k] = v
  return (obj if obj else _parse_type(schema), Field(**args))

  
"""
Contains a blob of things. Some can be initialized, some may not.
Wildcard "*" means everything.
Can be passed in dict (as part of inputs/outputs), Board, Tuple, and ModelMetaclass (representing schema field)
"""
class AttrDict(dict):
  __id = None
  def __init__(self, *args, **kwargs):
    for arg in args:
      # TODO: Handle multiple wildcard matches.
      kwargs = kwargs | {"*": arg}
    for k, v in kwargs.items():
      if isinstance(v, FieldInfo):
        # instantiate a new AttrDict
        #v = AttrDict()
        # TODO: Populate the other field info into the AttrDict.
        pass
      self[k] = v
  def __setattr__(self, key, value):
    if key == "__id" or key == "_AttrDict__id":
      return super().__setattr__(key, value)
    self[key] = value

  def get_or_assign_id(self, default_name = None, required=False):
    if self.__id is not None:
      return self.__id
    if required:
      raise Exception(f"Id should be assigned but is not: {self}")
    if default_name is not None:
      self.__id = default_name
    else:
      # TODO: Fix shared incrementer. It should be tracked based on context.
      self.__id = f"{self.__type}-{__class__.SHARED_INDEX}"
      __class__.SHARED_INDEX += 1
    return self.__id

  def __contains__(self, item):
    if item == "*":
      return True
    if super().__contains__(item):
      return True
    if super().__contains__("*") and isinstance(self["*"], dict):
      return item in self["*"]

  def __getattr__(self, item):
    if item == "__id":
      return super().__getattr__(item)
    if item not in self:
      return UNINITIALIZED
    return self[item]
  
  def __getitem__(self, item):
    if not super().__contains__(item):
      return super().__getitem__("*")[item]
    return super().__getitem__(item)

  def get_inputs(self) -> Dict[str, "Board"]:
    return self
  
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
    if v == field:
      return k
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

  type = "openai-gpt-3.5-turbo"

  SHARED_INDEX = {}
  output = {}

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
      input_schema = {}
      output_schema = {}
      #raise Exception("Board does not have input and output schemas defined.")
    else:
      input_schema, output_schema = get_args(type(self).__orig_bases__[0])
    return input_schema, output_schema


  def __init__(self, **kwargs) -> None:
    self.input_schema, self.output_schema = self._get_schema()
    self.components = {}
    self.inputs = {}
    self.id = None
    self.loaded = False

    for k, v in kwargs.items():
      if k == "id":
        self.id = v
        continue
      if self.input_schema and k not in self.input_schema.model_fields:
        pass
        #print(f"Unknown keyword: {k} for {self.id}")
      self.inputs[k] = v

    self.output: AttrDict = AttrDict() if not self.output_schema or not self.output_schema.model_fields else AttrDict(self.output_schema.model_fields)

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
    if name == "_ImportedClass__package_name":
      return super().__getattr__(name)
    if name in self.output:
      v = self.output[name]
    elif "*" in self.output: # when this Board outputs wildcard.
      v = (FieldInfo(name=name), self)
    else:
      raise AttributeError()
    if isinstance(v, FieldInfo):
      return (v, self)
    return v

  def __load__(self):
    if self.loaded:
      return
    self.loaded = True
    self.edges = []
    input_values = {}
    for k, v in self.input_schema.model_fields.items():
      if isinstance(v, FieldInfo):
        v = (v, self)
      input_values[k] = v
    self.inputs = self.inputs | input_values
    inputs = AttrDict(self.inputs)
    inputs.get_or_assign_id("input")
    self.output = self.describe(inputs)
  
  def finalize(self):
    raise Exception("Not implemented yet")
    inputs = set(self.inputs.keys())
    schema_inputs = set(self.input_schema.model_fields)
    missing_required = []
    for v in schema_inputs - inputs:
      # check if required.
      if v.required:
        missing_required.append(v)
    if missing_required:
      raise Exception(f"Missing required fields: {missing_required}")
    
  def get_configuration(self):
    # Filter out anything that's not a reference to another Board, field, or AttrDict.
    # get resolved inputs
    config = {k: v  for k, v in self._get_resolved_inputs().items() if not isinstance(v, Tuple) and not isinstance(v, Board) and not isinstance(v, dict)}
    if self.input_schema:
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

  def get_inputs(self) -> Dict[str, Self]:
    return self.inputs

  def __json__(self):
    self.__load__()
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
    
    # Populate input node.
    # TODO: Handle nested and un-nested input/output schemas.
    node = {"id": self.get_or_assign_id("input"), "type": "input", "configuration": {}}
    if self.input_schema:
      node["configuration"]["schema"] = self.input_schema.__json__()
    output["nodes"].append(node)

    # Populate output node.
    if self.output_schema:
      node = {"id": self.get_or_assign_id("output")}
      for output_field_name, output_field_info in self.output_schema.model_fields.items():
        child_schema = output_field_info.annotation
        if isinstance(child_schema, ModelMetaclass):
          self.output[output_field_name].get_or_assign_id(output_field_name)
          node = {"id": output_field_name, "type": "output", "configuration": {"schema": child_schema.__json__()}}
        else:
          node = {"id": output_field_name, "type": "output", "configuration": {"schema": self.output_schema.__json__()}}
        output["nodes"].append(node)

    all_components = [(k, v) for k, v in self.components.items()] + [(k, v) for k, v in self.output.items()]

    kits = set()

    # Component can be a Board or an AttrDict.
    already_visited_nodes = set()
    def iterate_component(name, component, assign_name=True) -> List[Dict]:
      nodes = []
      if isinstance(component, Board):
        inputs = component.inputs
        if component not in already_visited_nodes:
          already_visited_nodes.add(component)
          node = {
            # Assign type if is dependency. Assign name if is the Board.
            "id": component.get_or_assign_id(name) if name != "*" and assign_name else component.get_or_assign_id(),
            "type": component.type,
            "configuration": component.get_configuration(),
          }
          nodes.append(node)

        # check for kit
        package_name = getattr(component, "_ImportedClass__package_name", None)
        if package_name:
          kits.add(package_name)

      elif isinstance(component, AttrDict):
        inputs = component
      elif isinstance(component, Tuple):
        #print("Encountered fieldinfo while iterating components.")
        nodes.extend(iterate_component(component[1].id, component[1]))
        return nodes
      else:
        raise Exception("Unexpected component type.")
      for k, v in inputs.items():
        if isinstance(v, Board):
          nodes.extend(iterate_component(k, v, assign_name=False))
        elif isinstance(v, AttrDict):
          nodes.extend(iterate_component(k, v, assign_name=False))
      return nodes

    for name, component in all_components:
      output["nodes"].extend(iterate_component(name, component))

    output["edges"] = []

    already_visited_nodes = set()
    def iterate_component_edges(name, component, assign_name=True) -> List[Dict]:
      # TODO: Have this work for AttrDict by making AttrDict hashable.
      if component in already_visited_nodes:
        return []
      already_visited_nodes.add(component)
      edges = []
      if isinstance(component, Board):
        inputs = component.inputs
      elif isinstance(component, AttrDict):
        inputs = component
      elif isinstance(component, Tuple):
        #print("Encountered fieldinfo while iterating component edges")
        if component[1] == self:
          edge = {
            "from": component[1].get_or_assign_id(required=True),
            # TODO: Check if this should actually ahppen
            "to": get_field_name(component[0], {}),
            "out": get_field_name(component[0], {}),
            "in": name,
          }
        else:
          edge = {
            "from": component[1].get_or_assign_id(required=True),
            # TODO: This seems wrong way to determine "to".
            "to": get_field_name(component[0], component[1].output),
            "out": get_field_name(component[0], component[1].output),
            "in": name,
          }
        edges.append(edge)
        edges.extend(iterate_component_edges(component[1].id, component[1]))
        return edges
      else:
        raise Exception("Unexpected component type.")
      for k, v in inputs.items():
        if isinstance(v, Board):
          edge = {
            "from": v.get_or_assign_id(required=True),
            "to": component.get_or_assign_id(required=True),
            "out": k,
            "in": "" if k == "*" else k,
          }
          edges.append(edge)
          edges.extend(iterate_component_edges(k, v, assign_name=False))
        elif isinstance(v, Tuple):
          # TODO: Specifically for input, the "from" should be the input node, not from parent Board.
          if v[1] == self:
            edge = {
              "from": v[1].get_or_assign_id(required=True),
              "to": component.get_or_assign_id(required=True),
              "out": get_field_name(v[0], self.inputs),
              "in": k,
            }
          else:
            edge = {
              "from": v[1].get_or_assign_id(required=True),
              # TODO: This is a hacky way to determine node id. AttrDict should be assigned the id.
              "to": component.get_or_assign_id(required=True) if isinstance(component, Board) else name,
              "out": get_field_name(v[0], v[1].output),
              "in": k,
            }
          edges.append(edge)
        elif isinstance(v, AttrDict):
          # When does an AttrDict happen? It's a nested thing... but sometimes it should be done
          edge = {
            "from": v.get_or_assign_id(required=True),
            # TODO: This is a hacky way to determine node id. AttrDict should be assigned the id.
            "to": component.get_or_assign_id(required=True),# if isinstance(component, Board) else name, # maybe doesn't need this.
            "out": k,
            "in": "" if k == "*" else k,
          }
          edges.append(edge)
          edges.extend(iterate_component_edges(k, v, assign_name=False))
      return edges

    for name, component in all_components:
      output["edges"].extend(iterate_component_edges(name, component))
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
    all_inputs = kwargs
    # Arg should be treated as dicts
    # TODO: When passed in a whole arg, it should be wildcarded.
    for arg in args:
      if isinstance(arg, dict):
        #all_inputs = all_inputs | arg
        all_inputs = all_inputs | {"*": arg}
      elif isinstance(arg, SchemaObject):
        all_inputs = all_inputs | {"*": arg.model_fields}
      elif isinstance(arg, Board):
        all_inputs = all_inputs | {"*": arg}
      else:
        raise Exception("Unexpected type for arg")
    
    self.inputs = self.inputs | all_inputs
    inputs = AttrDict(**self._get_resolved_inputs())
    inputs.get_or_assign_id("input")
    self.output = self.describe(inputs)
    self.loaded = False
    return self

  @staticmethod
  def load(data: str) -> S:
    pass
  def describe(self, input: T) -> S:
    pass


FieldContext: TypeAlias = Tuple[FieldInfo, Optional[Board]]


