from ts_runtime import run_typescript


def test_local_file_browsing_is_restricted_to_development_and_test():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { MaterialsService } =
  require('./src/modules/education/courses/services/materials.service.ts');

const service = Object.create(MaterialsService.prototype);
service.configService = { get: () => 'production' };
service.storageProvider = 'local';
service.localStoragePath = './uploads';

(async () => {
  for (const operation of [
    () => service.searchLocalFiles('pdf'),
    () => service.getLocalFile('document.pdf'),
    () => service.listLocalDirectory(''),
  ]) {
    await assert.rejects(
      operation,
      error => error instanceof ForbiddenException,
    );
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_hash_addressed_local_pdf_requires_an_accessible_material():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { MaterialsService } =
  require('./src/modules/education/courses/services/materials.service.ts');

let file;
let readCount = 0;
const service = Object.create(MaterialsService.prototype);
service.prisma = {
  file: { findFirst: async () => file },
};
service.assertCanReadMaterial = async (material, userId) => {
  if (material.userId !== userId) {
    throw new Error('material access denied');
  }
};
service.readLocalPdfFile = async () => {
  readCount += 1;
  return { content: Buffer.from('pdf'), mimeType: 'application/pdf', fileName: 'file.pdf' };
};
service.logger = { log: () => undefined, error: () => undefined, warn: () => undefined };

(async () => {
  file = {
    filename: 'file.pdf',
    materials: [],
    previewMaterials: [],
  };
  await assert.rejects(
    service.serveLocalPdfByHash('hash-1', 'user-1'),
  );
  assert.equal(readCount, 0);

  file = {
    filename: 'file.pdf',
    materials: [{ userId: 'user-1' }],
    previewMaterials: [],
  };
  const result = await service.serveLocalPdfByHash('hash-1', 'user-1');
  assert.equal(result.content.toString(), 'pdf');
  assert.equal(readCount, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
