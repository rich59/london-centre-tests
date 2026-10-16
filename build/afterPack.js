// Remove WebGPU-only DirectX shader compiler DLLs (not used by the tests) to keep the installer under 100 MB.
const fs = require('fs'), path = require('path');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  for (const f of ['dxcompiler.dll', 'dxil.dll']) {
    const p = path.join(ctx.appOutDir, f);
    if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('  • afterPack removed', f); }
  }
};
