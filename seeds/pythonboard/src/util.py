import asyncio

def wrap_future(value):
  future = asyncio.Future()
  if isinstance(value, Exception):
    future.set_exception(value)
  else:
    future.set_result(value)
  return future