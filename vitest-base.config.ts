import { defineConfig } from 'vitest/config';

// Node 26 define un `localStorage` global experimental que queda inerte sin --localstorage-file.
// El entorno jsdom de vitest NO copia su propio localStorage cuando ya existe uno en el global
// (vitest/dist/chunks/index.*.js, getWindowKeys: `if (k in global) return keysArray.includes(k)`,
// y localStorage no está en esa whitelist). Resultado: los tests veían el de Node, muerto, y
// 21 tests fallaban con "Cannot read properties of undefined". El flag saca la propiedad del
// global y jsdom vuelve a ganar. Va por NODE_OPTIONS y no por poolOptions.execArgv porque
// vitest pisa el execArgv de sus workers; el env sí lo heredan.
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --no-experimental-webstorage`.trim();

export default defineConfig({
  test: {
    // jsdom arranca en about:blank, que es un origen opaco: ahí localStorage tira SecurityError.
    environmentOptions: { jsdom: { url: 'http://localhost' } },
  },
});
