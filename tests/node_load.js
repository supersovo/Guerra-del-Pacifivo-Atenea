// Carga los scripts clásicos del motor en un contexto de Node (para pruebas
// sin navegador del compilador de mapas, el BSP y la simulación).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScripts(files, extraGlobals) {
  const ctx = Object.assign({
    console: console, Math: Math, performance: { now: function () { return Date.now(); } },
    window: {}, document: undefined, navigator: {}, setTimeout: setTimeout
  }, extraGlobals || {});
  ctx.window = ctx;
  vm.createContext(ctx);
  const root = path.join(__dirname, '..');
  let code = '';
  for (const f of files) code += fs.readFileSync(path.join(root, f), 'utf8') + '\n;\n';
  vm.runInContext(code, ctx, { filename: 'bundle.js' });
  return ctx;
}

module.exports = { loadScripts: loadScripts };
