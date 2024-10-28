import { fetch } from './capabilities.js';

        export const RAW_WASM = Symbol();
        export default function() {

let wasm;
 function __wbg_set_wasm(val) {
wasm = val;
}


const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
}
return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
ptr = ptr >>> 0;
return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

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

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
}
return cachedDataViewMemory0;
}

function takeFromExternrefTable0(idx) {
const value = wasm.__wbindgen_export_0.get(idx);
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
* @param {string} code
* @param {string} json
* @returns {string}
*/
 function run_module(code, json) {
let deferred4_0;
let deferred4_1;
try {
const ptr0 = passStringToWasm0(code, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
const ptr1 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len1 = WASM_VECTOR_LEN;
const ret = wasm.run_module(ptr0, len0, ptr1, len1);
var ptr3 = ret[0];
var len3 = ret[1];
if (ret[3]) {
ptr3 = 0; len3 = 0;
throw takeFromExternrefTable0(ret[2]);
}
deferred4_0 = ptr3;
deferred4_1 = len3;
return getStringFromWasm0(ptr3, len3);
} finally {
wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
}
}

function getArrayJsValueFromWasm0(ptr, len) {
ptr = ptr >>> 0;
const mem = getDataViewMemory0();
const result = [];
for (let i = ptr; i < ptr + 4 * len; i += 4) {
result.push(wasm.__wbindgen_export_0.get(mem.getUint32(i, true)));
}
wasm.__externref_drop_slice(ptr, len);
return result;
}

function addToExternrefTable0(obj) {
const idx = wasm.__externref_table_alloc();
wasm.__wbindgen_export_0.set(idx, obj);
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

 function __wbg_fetch_f1f32fc92128b512(arg0, arg1, arg2) {
let deferred0_0;
let deferred0_1;
try {
deferred0_0 = arg1;
deferred0_1 = arg2;
const ret = fetch(getStringFromWasm0(arg1, arg2));
const ptr2 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len2 = WASM_VECTOR_LEN;
getDataViewMemory0().setInt32(arg0 + 4 * 1, len2, true);
getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr2, true);
} finally {
wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
}
};

 function __wbindgen_string_new(arg0, arg1) {
const ret = getStringFromWasm0(arg0, arg1);
return ret;
};

 function __wbg_warn_5fb7db206870e610(arg0, arg1) {
var v0 = getArrayJsValueFromWasm0(arg0, arg1).slice();
wasm.__wbindgen_free(arg0, arg1 * 4, 4);
console.warn(...v0);
};

 function __wbg_error_c900e646cf91e4e4(arg0, arg1) {
var v0 = getArrayJsValueFromWasm0(arg0, arg1).slice();
wasm.__wbindgen_free(arg0, arg1 * 4, 4);
console.error(...v0);
};

 function __wbg_log_4d5ee32fbc09e881(arg0, arg1) {
var v0 = getArrayJsValueFromWasm0(arg0, arg1).slice();
wasm.__wbindgen_free(arg0, arg1 * 4, 4);
console.log(...v0);
};

 function __wbindgen_error_new(arg0, arg1) {
const ret = new Error(getStringFromWasm0(arg0, arg1));
return ret;
};

 function __wbg_parse_51ee5409072379d3() { return handleError(function (arg0, arg1) {
const ret = JSON.parse(getStringFromWasm0(arg0, arg1));
return ret;
}, arguments) };

 function __wbindgen_throw(arg0, arg1) {
throw new Error(getStringFromWasm0(arg0, arg1));
};

 function __wbindgen_init_externref_table() {
const table = wasm.__wbindgen_export_0;
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
__wbg_fetch_f1f32fc92128b512
,
__wbindgen_string_new
,
__wbg_warn_5fb7db206870e610
,
__wbg_error_c900e646cf91e4e4
,
__wbg_log_4d5ee32fbc09e881
,
__wbindgen_error_new
,
__wbg_parse_51ee5409072379d3
,
__wbindgen_throw
,
__wbindgen_init_externref_table
,
};}