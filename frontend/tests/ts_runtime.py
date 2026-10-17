from pathlib import Path
import subprocess


FRONTEND_ROOT = Path(__file__).resolve().parents[1]

_BOOTSTRAP = r"""
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const projectRoot = process.cwd();
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.join(projectRoot, 'src', request.slice(2));
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      experimentalDecorators: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};
"""


def run_typescript(script: str) -> None:
    result = subprocess.run(
        ["node", "-e", _BOOTSTRAP + "\n" + script],
        cwd=FRONTEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
