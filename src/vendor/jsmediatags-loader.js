import jsmediatagsCode from '../../node_modules/jsmediatags/dist/jsmediatags.min.js?raw';

const g = typeof globalThis !== 'undefined' ? globalThis : self;
const origExports = g.exports;
const origModule = g.module;

g.exports = {};
g.module = { exports: g.exports };

const fn = new Function('globalThis', 'exports', 'module', jsmediatagsCode);
fn.call(g, g, g.exports, g.module);

const jsmediatags = g.module.exports.jsmediatags || g.module.exports;

g.exports = origExports;
g.module = origModule;

export default jsmediatags;
