from javascript import require, AsyncTask

import sys
import asyncio
import time

breadboard = require("../../graph-playground/dist/src/index.js")
running = True
@AsyncTask(start=True)
def run_js(task):
    breadboard.main(sys.argv[1:], True, timeout=None)
    global running
    running = False

@AsyncTask(start=True)
def listen_to_stdin(task):
    while (not task.stopping):
        value = input()
        breadboard.pass_in_input(str(value)) 

def main():
    while (running):
        pass

if __name__ == "__main__":
    main()
