import test from 'ava';
import { isValidStringifiedFunction } from '../src/nodes/run-javascript.js';

test('Valid function string', t => {
  const validFunction = (function () { return true; }).toString();
  t.true(isValidStringifiedFunction(validFunction));
});

test('Valid arrow function string', t => {
  const validArrowFunction = (() => true).toString();
  t.true(isValidStringifiedFunction(validArrowFunction));
});

test('Invalid function string', t => {
  const invalidFunction = "This is not a function";
  t.false(isValidStringifiedFunction(invalidFunction));
});

test('Empty string', t => {
  t.false(isValidStringifiedFunction(''));
});

test('Non-function but syntactically correct string', t => {
  const nonFunction = ({ key: 'value' }).toString();
  t.false(isValidStringifiedFunction(nonFunction));
});

test('Valid function string with comments', t => {
  const validFunctionWithComments = `/* Starting comment */ ${(function () { return true; }).toString()} // Ending comment`;
  t.true(isValidStringifiedFunction(validFunctionWithComments));
});

test('Valid function string with JSDoc comments', t => {
  const validFunctionWithJSDoc = `/** Example JSDoc comment */ ${(function () { return true; }).toString()}`;
  t.true(isValidStringifiedFunction(validFunctionWithJSDoc));
});

test('Valid named function string', t => {
  const namedFunction = (function myFunc() { return true; }).toString();
  t.true(isValidStringifiedFunction(namedFunction));
});

test('Valid arrow function with parameters', t => {
  // @ts-expect-error noImplicitAny
  const arrowFunctionWithParams = ((param1, param2) => { return param1 + param2; }).toString();
  t.true(isValidStringifiedFunction(arrowFunctionWithParams));
});

test('Valid async function', t => {
  const asyncFunction = (async function () { await Promise.resolve(); return true; }).toString();
  t.true(isValidStringifiedFunction(asyncFunction));
});

test('Valid function with parameters', t => {
  // @ts-expect-error noImplicitAny
  const functionWithParams = (function (param1, param2) { return param1 + param2; }).toString();
  t.true(isValidStringifiedFunction(functionWithParams));
});

test('Valid Immediately Invoked Function Expression', t => {
  const iife = "(function () { return true; })()";
  t.true(isValidStringifiedFunction(iife));
});

test('Valid function with different spacing', t => {
  const spacedFunction = (function myFunc() { return true; }).toString().replaceAll(" ", "  ").replaceAll("()", "  ( )  ");
  t.true(isValidStringifiedFunction(spacedFunction));
});

test('Valid nested function', t => {
  const nestedFunction = (function outer() { function inner() { return true; } return inner(); }).toString();
  t.true(isValidStringifiedFunction(nestedFunction));
});
