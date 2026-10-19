const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, readdirSync } = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const protoRoot = path.resolve(backendRoot, '..', 'protos');
const grpcToolsBin = path.resolve(backendRoot, 'node_modules', 'grpc-tools', 'bin');
const protoc = path.join(grpcToolsBin, 'protoc.js');
const protocBinary = path.join(
  grpcToolsBin,
  `protoc${process.platform === 'win32' ? '.exe' : ''}`,
);
const pluginName = `protoc-gen-ts_proto${process.platform === 'win32' ? '.CMD' : ''}`;
const plugin = path.resolve(backendRoot, 'node_modules', '.bin', pluginName);
const output = path.resolve(backendRoot, 'src', 'generated', 'grpc');
const protoFiles = readdirSync(protoRoot)
  .filter((file) => file.endsWith('.proto'))
  .sort()
  .map((file) => path.join(protoRoot, file));

if (!protoFiles.length) {
  throw new Error(`No .proto files found in ${protoRoot}`);
}
if (!existsSync(protoc) || !existsSync(protocBinary)) {
  throw new Error(
    `grpc-tools protoc was not installed at ${protocBinary}. Reinstall dependencies and allow the grpc-tools install script.`,
  );
}
if (!existsSync(plugin)) {
  throw new Error(`ts-proto plugin was not found at ${plugin}`);
}

mkdirSync(output, { recursive: true });

const args = [
  `--plugin=protoc-gen-ts_proto=${plugin}`,
  `--ts_proto_out=${output}`,
  '--ts_proto_opt=nestJs=true,outputServices=grpc-js,paths=source_relative',
  '-I',
  protoRoot,
  '-I',
  grpcToolsBin,
  ...protoFiles,
];

const result = spawnSync(process.execPath, [protoc, ...args], {
  cwd: backendRoot,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
