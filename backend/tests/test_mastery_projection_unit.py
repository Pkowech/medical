import json
from pathlib import Path

from ts_runtime import run_typescript


FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "shared_fixtures"
    / "learning-activity-history.json"
)


def test_backend_mastery_read_uses_rust_owned_probability():
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    run_typescript(
        f"""
const assert = require('node:assert/strict');
const {{ AssessmentAnalyticsService }} =
  require('./src/modules/ai-analytics/services/assessment-analytics.service.ts');
const fixture = {json.dumps(fixture)};
const service = Object.create(AssessmentAnalyticsService.prototype);
const rustMastery = {{
  [fixture.mastery.skillId]: fixture.mastery.expectedPKnown,
}};
const {{ of }} = require('rxjs');
service.redisService = {{
  get: async () => null,
  set: async () => undefined,
}};
service.callGrpc = async () => ({{ pKnownBySkill: rustMastery }});
service.analyticsServiceGrpc = {{
  getUserAbility: () => of({{ pKnownBySkill: rustMastery }}),
}};
service.performanceMetrics = {{ recordMetric: async () => undefined }};
service.logger = {{ error: () => undefined }};

(async () => {{
  const result = await service.getMastery(fixture.userId);
  assert.equal(result[fixture.mastery.skillId], fixture.mastery.expectedPKnown);
}})().catch(error => {{
  console.error(error);
  process.exitCode = 1;
}});
"""
    )
