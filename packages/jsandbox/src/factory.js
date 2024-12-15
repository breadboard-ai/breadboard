import { fetch, secrets, invoke, output, describe } from './capabilities.js';

        export const RAW_WASM = Symbol();
        export default function() {

let wasm;
 function __wbg_set_wasm(val) {
wasm = val;
}


let WASM_VECTOR_LEN = 0;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
}
return cachedUint8ArrayMemory0;
}

const lTextEncoder = typeof TextEncoder === 'undefined' ? (0, module.require)('util').TextEncoder : TextEncoder;

let cachedTextEncoder = new lTextEncoder('utf-8');

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
? function (arg, view) {
return cachedTextEncoder.encodeInto(arg, view);
}
: function (arg, view) {
const buf = cachedTextEncoder.encode(arg);
view.set(buf);
return {
read: arg.length,
written: buf.length
};
});

function passStringToWasm0(arg, malloc, realloc) {

if (realloc === undefined) {
const buf = cachedTextEncoder.encode(arg);
const ptr = malloc(buf.length, 1) >>> 0;
getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
WASM_VECTOR_LEN = buf.length;
return ptr;
}

let len = arg.length;
let ptr = malloc(len, 1) >>> 0;

const mem = getUint8ArrayMemory0();

let offset = 0;

for (; offset < len; offset++) {
const code = arg.charCodeAt(offset);
if (code > 0x7F) break;
mem[ptr + offset] = code;
}

if (offset !== len) {
if (offset !== 0) {
arg = arg.slice(offset);
}
ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
const ret = encodeString(arg, view);

offset += ret.written;
ptr = realloc(ptr, len, offset, 1) >>> 0;
}

WASM_VECTOR_LEN = offset;
return ptr;
}

function isLikeNone(x) {
return x === undefined || x === null;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
}
return cachedDataViewMemory0;
}

const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

function getStringFromWasm0(ptr, len) {
ptr = ptr >>> 0;
return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function debugString(val) {
// primitive types
const type = typeof val;
if (type == 'number' || type == 'boolean' || val == null) {
return  `${val}`;
}
if (type == 'string') {
return `"${val}"`;
}
if (type == 'symbol') {
const description = val.description;
if (description == null) {
return 'Symbol';
} else {
return `Symbol(${description})`;
}
}
if (type == 'function') {
const name = val.name;
if (typeof name == 'string' && name.length > 0) {
return `Function(${name})`;
} else {
return 'Function';
}
}
// objects
if (Array.isArray(val)) {
const length = val.length;
let debug = '[';
if (length > 0) {
debug += debugString(val[0]);
}
for(let i = 1; i < length; i++) {
debug += ', ' + debugString(val[i]);
}
debug += ']';
return debug;
}
// Test for built-in
const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
let className;
if (builtInMatches.length > 1) {
className = builtInMatches[1];
} else {
// Failed to match the standard '[object ClassName]'
return toString.call(val);
}
if (className == 'Object') {
// we're a user defined class or Object
// JSON.stringify avoids problems with cycles, and is generally much
// easier than looping through ownProperties of `val`.
try {
return 'Object(' + JSON.stringify(val) + ')';
} catch (_) {
return 'Object';
}
}
// errors
if (val instanceof Error) {
return `${val.name}: ${val.message}\n${val.stack}`;
}
// TODO we could test for more things here, like `Set`s and `Map`s.
return className;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
? { register: () => {}, unregister: () => {} }
: new FinalizationRegistry(state => {
wasm.__wbindgen_export_3.get(state.dtor)(state.a, state.b)
});

function makeMutClosure(arg0, arg1, dtor, f) {
const state = { a: arg0, b: arg1, cnt: 1, dtor };
const real = (...args) => {
// First up with a closure we increment the internal reference
// count. This ensures that the Rust closure environment won't
// be deallocated while we're invoking it.
state.cnt++;
const a = state.a;
state.a = 0;
try {
return f(a, state.b, ...args);
} finally {
if (--state.cnt === 0) {
wasm.__wbindgen_export_3.get(state.dtor)(a, state.b);
CLOSURE_DTORS.unregister(state);
} else {
state.a = a;
}
}
};
real.original = state;
CLOSURE_DTORS.register(real, state, state);
return real;
}
function __wbg_adapter_24(arg0, arg1, arg2) {
wasm.closure69_externref_shim(arg0, arg1, arg2);
}

function getArrayJsValueFromWasm0(ptr, len) {
ptr = ptr >>> 0;
const mem = getDataViewMemory0();
const result = [];
for (let i = ptr; i < ptr + 4 * len; i += 4) {
result.push(wasm.__wbindgen_export_2.get(mem.getUint32(i, true)));
}
wasm.__externref_drop_slice(ptr, len);
return result;
}

function takeFromExternrefTable0(idx) {
const value = wasm.__wbindgen_export_2.get(idx);
wasm.__externref_table_dealloc(idx);
return value;
}
/**
* @param {string} code
* @returns {string}
*/
 function eval_code(code) {
let deferred3_0;
let deferred3_1;
try {
const ptr0 = passStringToWasm0(code, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.eval_code(ptr0, len0);
var ptr2 = ret[0];
var len2 = ret[1];
if (ret[3]) {
ptr2 = 0; len2 = 0;
throw takeFromExternrefTable0(ret[2]);
}
deferred3_0 = ptr2;
deferred3_1 = len2;
return getStringFromWasm0(ptr2, len2);
} finally {
wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
}
}

/**
* @param {string} invocation_id
* @param {string} method
* @param {string} name
* @param {any} modules
* @param {string} code
* @param {string} json
* @returns {Promise<string>}
*/
 function run_module(invocation_id, method, name, modules, code, json) {
const ptr0 = passStringToWasm0(invocation_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
const ptr1 = passStringToWasm0(method, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len1 = WASM_VECTOR_LEN;
const ptr2 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len2 = WASM_VECTOR_LEN;
const ptr3 = passStringToWasm0(code, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len3 = WASM_VECTOR_LEN;
const ptr4 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len4 = WASM_VECTOR_LEN;
const ret = wasm.run_module(ptr0, len0, ptr1, len1, ptr2, len2, modules, ptr3, len3, ptr4, len4);
return ret;
}

function notDefined(what) { return () => { throw new Error(`${what} is not defined`); }; }

function addToExternrefTable0(obj) {
const idx = wasm.__externref_table_alloc();
wasm.__wbindgen_export_2.set(idx, obj);
return idx;
}

function handleError(f, args) {
try {
return f.apply(this, args);
} catch (e) {
const idx = addToExternrefTable0(e);
wasm.__wbindgen_exn_store(idx);
}
}
function __wbg_adapter_61(arg0, arg1, arg2, arg3) {
wasm.closure90_externref_shim(arg0, arg1, arg2, arg3);
}

 function __wbg_invoke_b869e83afb3faed8(arg0, arg1, arg2, arg3) {
let deferred0_0;
let deferred0_1;
let deferred1_0;
let deferred1_1;
try {
deferred0_0 = arg0;
deferred0_1 = arg1;
deferred1_0 = arg2;
deferred1_1 = arg3;
const ret = invoke(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
return ret;
} finally {
wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
}
};

 function __wbindgen_string_get(arg0, arg1) {
const obj = arg1;
const ret = typeof(obj) === 'string' ? obj : undefined;
var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
var len1 = WASM_VECTOR_LEN;
getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

 function __wbg_secrets_52d52956bc8d3d7b(arg0, arg1, arg2, arg3) {
let deferred0_0;
let deferred0_1;
let deferred1_0;
let deferred1_1;
try {
deferred0_0 = arg0;
deferred0_1 = arg1;
deferred1_0 = arg2;
deferred1_1 = arg3;
const ret = secrets(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
return ret;
} finally {
wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
}
};

 function __wbg_describe_47b99ea8f240afa3(arg0, arg1, arg2, arg3) {
let deferred0_0;
let deferred0_1;
let deferred1_0;
let deferred1_1;
try {
deferred0_0 = arg0;
deferred0_1 = arg1;
deferred1_0 = arg2;
deferred1_1 = arg3;
const ret = describe(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
return ret;
} finally {
wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
}
};

 function __wbg_fetch_f1f32fc92128b512(arg0, arg1, arg2, arg3) {
let deferred0_0;
let deferred0_1;
let deferred1_0;
let deferred1_1;
try {
deferred0_0 = arg0;
deferred0_1 = arg1;
deferred1_0 = arg2;
deferred1_1 = arg3;
const ret = fetch(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
return ret;
} finally {
wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
}
};

 function __wbg_output_ced2de1f6ad7885f(arg0, arg1, arg2, arg3) {
let deferred0_0;
let deferred0_1;
let deferred1_0;
let deferred1_1;
try {
deferred0_0 = arg0;
deferred0_1 = arg1;
deferred1_0 = arg2;
deferred1_1 = arg3;
const ret = output(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
return ret;
} finally {
wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
}
};

 function __wbindgen_string_new(arg0, arg1) {
const ret = getStringFromWasm0(arg0, arg1);
return ret;
};

 function __wbg_log_4d5ee32fbc09e881(arg0, arg1) {
var v0 = getArrayJsValueFromWasm0(arg0, arg1).slice();
wasm.__wbindgen_free(arg0, arg1 * 4, 4);
console.log(...v0);
};

 function __wbg_error_c900e646cf91e4e4(arg0, arg1) {
var v0 = getArrayJsValueFromWasm0(arg0, arg1).slice();
wasm.__wbindgen_free(arg0, arg1 * 4, 4);
console.error(...v0);
};

 function __wbg_warn_5fb7db206870e610(arg0, arg1) {
var v0 = getArrayJsValueFromWasm0(arg0, arg1).slice();
wasm.__wbindgen_free(arg0, arg1 * 4, 4);
console.warn(...v0);
};

 function __wbindgen_error_new(arg0, arg1) {
const ret = new Error(getStringFromWasm0(arg0, arg1));
return ret;
};

 function __wbindgen_cb_drop(arg0) {
const obj = arg0.original;
if (obj.cnt-- == 1) {
obj.a = 0;
return true;
}
const ret = false;
return ret;
};

 function __wbg_queueMicrotask_848aa4969108a57e(arg0) {
const ret = arg0.queueMicrotask;
return ret;
};

 function __wbindgen_is_function(arg0) {
const ret = typeof(arg0) === 'function';
return ret;
};

 const __wbg_queueMicrotask_c5419c06eab41e73 = typeof queueMicrotask == 'function' ? queueMicrotask : notDefined('queueMicrotask');

 function __wbg_get_5419cf6b954aa11d(arg0, arg1) {
const ret = arg0[arg1 >>> 0];
return ret;
};

 function __wbg_length_f217bbbf7e8e4df4(arg0) {
const ret = arg0.length;
return ret;
};

 function __wbg_newnoargs_1ede4bf2ebbaaf43(arg0, arg1) {
const ret = new Function(getStringFromWasm0(arg0, arg1));
return ret;
};

 function __wbg_call_a9ef466721e824f2() { return handleError(function (arg0, arg1) {
const ret = arg0.call(arg1);
return ret;
}, arguments) };

 function __wbg_self_bf91bf94d9e04084() { return handleError(function () {
const ret = self.self;
return ret;
}, arguments) };

 function __wbg_window_52dd9f07d03fd5f8() { return handleError(function () {
const ret = window.window;
return ret;
}, arguments) };

 function __wbg_globalThis_05c129bf37fcf1be() { return handleError(function () {
const ret = globalThis.globalThis;
return ret;
}, arguments) };

 function __wbg_global_3eca19bb09e9c484() { return handleError(function () {
const ret = global.global;
return ret;
}, arguments) };

 function __wbindgen_is_undefined(arg0) {
const ret = arg0 === undefined;
return ret;
};

 function __wbg_from_91a67a5f04c98a54(arg0) {
const ret = Array.from(arg0);
return ret;
};

 function __wbg_call_3bfa248576352471() { return handleError(function (arg0, arg1, arg2) {
const ret = arg0.call(arg1, arg2);
return ret;
}, arguments) };

 function __wbg_entries_c02034de337d3ee2(arg0) {
const ret = Object.entries(arg0);
return ret;
};

 function __wbg_new_1073970097e5a420(arg0, arg1) {
try {
var state0 = {a: arg0, b: arg1};
var cb0 = (arg0, arg1) => {
const a = state0.a;
state0.a = 0;
try {
return __wbg_adapter_61(a, state0.b, arg0, arg1);
} finally {
state0.a = a;
}
};
const ret = new Promise(cb0);
return ret;
} finally {
state0.a = state0.b = 0;
}
};

 function __wbg_resolve_0aad7c1484731c99(arg0) {
const ret = Promise.resolve(arg0);
return ret;
};

 function __wbg_then_748f75edfb032440(arg0, arg1) {
const ret = arg0.then(arg1);
return ret;
};

 function __wbg_then_4866a7d9f55d8f3e(arg0, arg1, arg2) {
const ret = arg0.then(arg1, arg2);
return ret;
};

 function __wbg_parse_51ee5409072379d3() { return handleError(function (arg0, arg1) {
const ret = JSON.parse(getStringFromWasm0(arg0, arg1));
return ret;
}, arguments) };

 function __wbindgen_debug_string(arg0, arg1) {
const ret = debugString(arg1);
const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len1 = WASM_VECTOR_LEN;
getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

 function __wbindgen_throw(arg0, arg1) {
throw new Error(getStringFromWasm0(arg0, arg1));
};

 function __wbindgen_closure_wrapper233(arg0, arg1, arg2) {
const ret = makeMutClosure(arg0, arg1, 70, __wbg_adapter_24);
return ret;
};

 function __wbindgen_init_externref_table() {
const table = wasm.__wbindgen_export_2;
const offset = table.grow(4);
table.set(0, undefined);
table.set(offset + 0, undefined);
table.set(offset + 1, null);
table.set(offset + 2, true);
table.set(offset + 3, false);
;
};

return { [RAW_WASM]: wasm, 
__wbg_set_wasm
,
eval_code
,
run_module
,
__wbg_invoke_b869e83afb3faed8
,
__wbindgen_string_get
,
__wbg_secrets_52d52956bc8d3d7b
,
__wbg_describe_47b99ea8f240afa3
,
__wbg_fetch_f1f32fc92128b512
,
__wbg_output_ced2de1f6ad7885f
,
__wbindgen_string_new
,
__wbg_log_4d5ee32fbc09e881
,
__wbg_error_c900e646cf91e4e4
,
__wbg_warn_5fb7db206870e610
,
__wbindgen_error_new
,
__wbindgen_cb_drop
,
__wbg_queueMicrotask_848aa4969108a57e
,
__wbindgen_is_function
,
__wbg_queueMicrotask_c5419c06eab41e73
,
__wbg_get_5419cf6b954aa11d
,
__wbg_length_f217bbbf7e8e4df4
,
__wbg_newnoargs_1ede4bf2ebbaaf43
,
__wbg_call_a9ef466721e824f2
,
__wbg_self_bf91bf94d9e04084
,
__wbg_window_52dd9f07d03fd5f8
,
__wbg_globalThis_05c129bf37fcf1be
,
__wbg_global_3eca19bb09e9c484
,
__wbindgen_is_undefined
,
__wbg_from_91a67a5f04c98a54
,
__wbg_call_3bfa248576352471
,
__wbg_entries_c02034de337d3ee2
,
__wbg_new_1073970097e5a420
,
__wbg_resolve_0aad7c1484731c99
,
__wbg_then_748f75edfb032440
,
__wbg_then_4866a7d9f55d8f3e
,
__wbg_parse_51ee5409072379d3
,
__wbindgen_debug_string
,
__wbindgen_throw
,
__wbindgen_closure_wrapper233
,
__wbindgen_init_externref_table
,
};}