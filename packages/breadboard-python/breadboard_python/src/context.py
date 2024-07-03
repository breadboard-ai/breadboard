DESCRIBE_CONTEXT_COUNT = 0

class BreadboardDescribeContext(): 
  def __init__(self): 
    pass
           
  def __enter__(self): 
    global DESCRIBE_CONTEXT_COUNT
    DESCRIBE_CONTEXT_COUNT += 1
    print(f"KEX: context count: {DESCRIBE_CONTEXT_COUNT}")
    return self
       
  def __exit__(self, exc_type, exc_value, exc_traceback):
    global DESCRIBE_CONTEXT_COUNT
    DESCRIBE_CONTEXT_COUNT -= 1 
    print(f"KEX: context count after -: {DESCRIBE_CONTEXT_COUNT}")

def in_breadboard_describe_context():
  global DESCRIBE_CONTEXT_COUNT
  return DESCRIBE_CONTEXT_COUNT > 0