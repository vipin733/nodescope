const fs = require('fs');
const path = 'packages/core/src/adapters/fastify.ts';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(
  'const response = await nodescope.api.handle({',
  'console.log("HANDLE API", { method: request.method, originalUrl: request.url, apiUrl });\n    const response = await nodescope.api.handle({'
);
fs.writeFileSync(path, code);
