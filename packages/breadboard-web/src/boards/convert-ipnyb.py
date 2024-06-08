import sys
import json
from breadboard_python.main import Board, Field, SchemaObject
from breadboard_python.import_node import require
from breadboard_python.adhoc import breadboard_node
import json
from typing import Optional, Union, Callable, List

testing_api = """{
  \"nbformat\": 4,
  \"nbformat_minor\": 0,
  \"metadata\": {
    \"colab\": {
      \"provenance\": []
    },
    \"kernelspec\": {
      \"name\": \"python3\",
      \"display_name\": \"Python 3\"
    },
    \"language_info\": {
      \"name\": \"python\"
    }
  },
  \"cells\": [
    {
      \"cell_type\": \"code\",
      \"source\": [
        \"a = {\\\"model\\\": \\\"models/gemini-1.5-pro-eval-or-fc-patch-si-v1\\\", \\\"contents\\\": [{\\\"role\\\": \\\"model\\\", \\\"parts\\\": [{\\\"function_call\\\": {\\\"name\\\": \\\"book_tickets\\\", \\\"args\\\": {\\\"movie\\\": \\\"Mission Impossible Dead Reckoning Part 1\\\", \\\"theater\\\": \\\"Regal Edwards 14\\\", \\\"location\\\": \\\"Mountain View CA\\\", \\\"showtime\\\": \\\"7:30\\\", \\\"date\\\": \\\"today\\\", \\\"num_tix\\\": \\\"2\\\"}}}]}], \\\"tools\\\": [{\\\"function_declarations\\\": [{\\\"name\\\": \\\"find_movies\\\", \\\"description\\\": \\\"find movie titles currently playing in theaters based on any description, genre, title words, etc.\\\", \\\"parameters\\\": {\\\"type\\\": \\\"OBJECT\\\", \\\"properties\\\": {\\\"location\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"The city and state, e.g. San Francisco, CA or a zip code e.g. 95616\\\"}, \\\"description\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Any kind of description including category or genre, title words, attributes, etc.\\\"}}, \\\"required\\\": [\\\"description\\\"]}}, {\\\"name\\\": \\\"find_theaters\\\", \\\"description\\\": \\\"find theaters based on location and optionally movie title which are is currently playing in theaters\\\", \\\"parameters\\\": {\\\"type\\\": \\\"OBJECT\\\", \\\"properties\\\": {\\\"location\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"The city and state, e.g. San Francisco, CA or a zip code e.g. 95616\\\"}, \\\"movie\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Any movie title\\\"}}, \\\"required\\\": [\\\"location\\\"]}}, {\\\"name\\\": \\\"get_showtimes\\\", \\\"description\\\": \\\"Find the start times for movies playing in a specific theater\\\", \\\"parameters\\\": {\\\"type\\\": \\\"OBJECT\\\", \\\"properties\\\": {\\\"location\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"The city and state, e.g. San Francisco, CA or a zip code e.g. 95616\\\"}, \\\"movie\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Any movie title\\\"}, \\\"theater\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Name of the theater\\\"}, \\\"date\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Date for requested showtime\\\"}}, \\\"required\\\": [\\\"location\\\", \\\"movie\\\", \\\"theater\\\", \\\"date\\\"]}}, {\\\"name\\\": \\\"get_attributes\\\", \\\"description\\\": \\\"Find the basic features of a movie, including the director, producer, runtime, rating (like G, PG, etc.), synopsis, release date, or studio\\\", \\\"parameters\\\": {\\\"type\\\": \\\"OBJECT\\\", \\\"properties\\\": {\\\"attribute\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Any attribute the user is looking for including the director, producer, runtime, rating (like G, PG, etc.), synopsis, release date, or studio\\\"}, \\\"movie\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Any movie title\\\"}}, \\\"required\\\": [\\\"attribute\\\", \\\"movie\\\"]}}, {\\\"name\\\": \\\"get_movie_reviews\\\", \\\"description\\\": \\\"Gets the audience and/or critic reviews for a given movie\\\", \\\"parameters\\\": {\\\"type\\\": \\\"OBJECT\\\", \\\"properties\\\": {\\\"movie\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Any movie playing in theaters.\\\"}, \\\"review_type\\\": {\\\"type\\\": \\\"STRING\\\", \\\"enum\\\": [\\\"audience\\\", \\\"critic\\\", \\\"both\\\"]}}, \\\"required\\\": [\\\"movie\\\", \\\"review_type\\\"]}}, {\\\"name\\\": \\\"book_tickets\\\", \\\"description\\\": \\\"Completes transaction to purchase tickets for a movie playing in a theater, assuming the user payment information is already on file\\\", \\\"parameters\\\": {\\\"type\\\": \\\"OBJECT\\\", \\\"properties\\\": {\\\"movie\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Any movie playing in theaters.\\\"}, \\\"theater\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Name of the movie theater\\\"}, \\\"location\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"City and state or zip code where the movie theater is located\\\"}, \\\"showtime\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Time the movie begins\\\"}, \\\"date\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Date for the movie showing\\\"}, \\\"num_tix\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Number of tickets to be purchased\\\"}}, \\\"required\\\": [\\\"movie\\\", \\\"theater\\\", \\\"location\\\", \\\"showtime\\\", \\\"date\\\", \\\"num_tix\\\"]}}, {\\\"name\\\": \\\"check_ticket_availability\\\", \\\"description\\\": \\\"Checks that tickets for a particular movie, showtime, theater, time, and date are available\\\", \\\"parameters\\\": {\\\"type\\\": \\\"OBJECT\\\", \\\"properties\\\": {\\\"movie\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Any movie playing in theaters.\\\"}, \\\"theater\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Name of the movie theater\\\"}, \\\"location\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"City and state or zip code where the movie theater is located\\\"}, \\\"showtime\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Time the movie begins\\\"}, \\\"date\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Date for the movie showing\\\"}, \\\"num_tix\\\": {\\\"type\\\": \\\"STRING\\\", \\\"description\\\": \\\"Number of tickets to be purchased\\\"}}, \\\"required\\\": [\\\"movie\\\", \\\"theater\\\", \\\"location\\\", \\\"showtime\\\", \\\"date\\\", \\\"num_tix\\\"]}}]}], \\\"generation_config\\\": {\\\"temperature\\\": 0.0}}\\n\"
      ],
      \"metadata\": {
        \"id\": \"QMOrYHhkD2QF\"
      },
      \"execution_count\": null,
      \"outputs\": []
    },
    {
      \"cell_type\": \"code\",
      \"source\": [
        \"from google3.google.ai.generativelanguage.v1main import content_pb2\\n\",
        \"from google3.google.ai.generativelanguage.v1main import generative_service_pb2\\n\",
        \"from google.protobuf import json_format\\n\",
        \"import json\\n\",
        \"\\n\",
        \"target = json_format.Parse(a, generative_service_pb2.GenerateContentRequest())\\n\",
        \"requests = [target]\"
      ],
      \"metadata\": {
        \"id\": \"EnJPz0xXD-Ue\"
      },
      \"execution_count\": null,
      \"outputs\": []
    },
    {
      \"cell_type\": \"code\",
      \"source\": [
        \"from google3.google.ai.generativelanguage.v1main import content_pb2\\n\",
        \"from google3.google.ai.generativelanguage.v1main import generative_service_pb2\\n\",
        \"\\n\",
        \"from google3.labs.language.genai.scripts.multimodal import client\"
      ],
      \"metadata\": {
        \"id\": \"9NyZ1p5rDigJ\"
      },
      \"execution_count\": null,
      \"outputs\": []
    },
    {
      \"cell_type\": \"code\",
      \"source\": [
        \"responses = {}\\n\",
        \"service = \\\"blade:google.ai.generativelanguage.v1main.generativeservice-autopush\\\"\\n\",
        \"#service = \\\"localhost:9876\\\"\\n\",
        \"#service = \\\"sdh.mtv.corp.google.com:9876\\\"\\n\",
        \"from google3.labs.language.genai.scripts.multimodal import client\\n\",
        \"\\n\",
        \"cli = client.Client(service, api_key=API_KEY)\\n\",
        \"for i, r in enumerate(requests):\\n\",
        \"  #print(f\\\"\\\\n---Index: {i}---\\\")\\n\",
        \"  try:\\n\",
        \"    response_string = cli.generate(r)\\n\",
        \"    responses[i] = response_string[1].candidates[0]\\n\",
        \"    print(response_string[1].candidates[0].content.parts[0])\\n\",
        \"  except Exception as e:\\n\",
        \"    responses[i] = e\\n\",
        \"    print(e)\\n\",
        \"    print(response_string)\"
      ],
      \"metadata\": {
        \"id\": \"aw432VjeDpBO\"
      },
      \"execution_count\": null,
      \"outputs\": []
    }
  ]
}"""


def create_python_board(code: str):
  class RunPythonBoard(Board):
    title = "Run Python"
    type = "runPython"
    description = "Runs python code."
    _is_node = True
    _source_code = code
    _pickled_code = None
    #_python_version = '.'.join(str(x) for x in sys.version_info[:3])
    _python_version = "3"
    def describe(self, input, output):
      pass
      
    def get_configuration(self):
      config = super().get_configuration()
      if "code" in config:
        raise Exception("Code is already populated.")
      config["code"] = self._source_code
      config["pickle"] = self._pickled_code
      config["python_version"] = self._python_version
      return config

  return RunPythonBoard


notebook = json.loads(testing_api)

nodes = []
for cell in notebook["cells"]:
  source = "".join(cell["source"])
  nodes.append(create_python_board(source))

class TestPythonBoard(Board):
  title = "Test Python Board on runtime"
  description = "Some simple board that's written in Python and runs on an IPython runtime."
  def describe(self, input, output):
    prev = input
    for node in nodes:
      prev = node(prev)
    output(prev)

if __name__ == "__main__":
  a = TestPythonBoard()
  with open(sys.argv[1], "w") as f:
    json.dump(a, f, indent=2)