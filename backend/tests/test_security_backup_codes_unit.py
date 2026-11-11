from ts_runtime import run_typescript


def test_backup_codes_are_hashed_single_use_and_only_valid_for_enabled_2fa():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Module } = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'speakeasy') {
    return {
      generateSecret: () => ({ base32: 'secret', ascii: 'secret' }),
      totp: { verify: () => false },
    };
  }
  if (request === 'qrcode') return { toDataURL: async () => 'qr' };
  return originalLoad.call(this, request, parent, isMain);
};

const { BadRequestException } = require('@nestjs/common');
const { SecurityService } =
  require('./src/modules/auth/services/security.service.ts');

let enabled = true;
let storedCodes = [];
const service = Object.create(SecurityService.prototype);
service.prisma = {
  userSecuritySettings: {
    findUnique: async () => ({
      twoFactorEnabled: enabled,
      twoFactorSecret: 'secret',
      backupCodes: [...storedCodes],
    }),
    update: async ({ data }) => {
      storedCodes = [...data.backupCodes];
    },
    updateMany: async ({ where, data }) => {
      if (!enabled || !storedCodes.includes(where.backupCodes.has)) {
        return { count: 0 };
      }
      storedCodes = [...data.backupCodes];
      return { count: 1 };
    },
  },
};

(async () => {
  const codes = await service.generateNewBackupCodes('user-1');
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  const expectedHashes = codes.map(code =>
    crypto.createHash('sha256').update(code).digest('hex'),
  );
  assert.deepEqual(storedCodes, expectedHashes);
  assert.ok(codes.every(code => !storedCodes.includes(code)));

  const results = await Promise.all([
    service.verifyTwoFactor('user-1', codes[0]),
    service.verifyTwoFactor('user-1', codes[0]),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(storedCodes.includes(expectedHashes[0]), false);

  storedCodes = ['LEGACYCODE1'];
  assert.equal(await service.verifyTwoFactor('user-1', 'legacy-code1'), true);
  assert.deepEqual(storedCodes, []);

  enabled = false;
  await assert.rejects(
    service.generateNewBackupCodes('user-1'),
    error => error instanceof BadRequestException,
  );
  assert.equal(await service.verifyTwoFactor('user-1', 'LEGACYCODE1'), false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
