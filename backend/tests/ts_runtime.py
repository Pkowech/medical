from pathlib import Path
import subprocess


BACKEND_ROOT = Path(__file__).resolve().parents[1]

_BOOTSTRAP = r"""
const fs = require('node:fs');
const path = require('node:path');
const RuntimeModule = require('node:module');
const ts = require('typescript');
require('reflect-metadata');

const projectRoot = process.cwd();
const originalResolve = RuntimeModule._resolveFilename;
RuntimeModule._resolveFilename = function (request, parent, isMain, options) {
  const aliases = [
    ['#common/', 'src/common/'],
    ['#infrastructure/', 'src/infrastructure/'],
    ['#modules/', 'src/modules/'],
  ];
  for (const [prefix, target] of aliases) {
    if (request.startsWith(prefix)) {
      request = path.join(projectRoot, target, request.slice(prefix.length));
      break;
    }
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
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
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
