import * as core from '@actions/core';
import * as github from '@actions/github';
export default () => {
    console.log({ event: github.context.eventName });
    console.log('Hello world!');
    core.setOutput('hello', 'world');
};
