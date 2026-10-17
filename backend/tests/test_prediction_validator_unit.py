from ts_runtime import run_typescript


def test_prediction_validation_empty_window_and_score_validation():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { PredictionValidatorService } =
  require('./src/modules/ai-analytics/services/prediction-validator.service.ts');
const prisma = {
  predictionValidation: {
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
    create: async () => undefined,
    findFirst: async () => null,
    update: async () => undefined,
  },
  userRole: { findMany: async () => [] },
  notification: { create: async () => undefined },
};
const service = new PredictionValidatorService(prisma);

(async () => {
  const report = await service.runValidation();
  assert.equal(report.totalValidated, 0);
  assert.equal(report.isAccurate, null);
  assert.equal(report.precision, 0);

  await assert.rejects(
    service.recordPrediction('user-1', 'assessment-1', 85),
    /predictedScore must be a finite probability between 0 and 1/,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
