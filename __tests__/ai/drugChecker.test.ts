import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/ai/drug-check.ts';
import { checkDrugConflicts } from '../../lib/ai/features/drugChecker.ts';

function createRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
    end(payload: string) {
      this.body = payload ? JSON.parse(payload) : undefined;
    },
  };
}

test('drug checker uses mocked callAI', async () => {
  const result = await checkDrugConflicts({
    new_drug: 'Ibuprofen 400mg',
    existing_medications: ['Warfarin 5mg'],
    known_conditions: ['Atrial Fibrillation'],
    allergies: ['Penicillin'],
  }, async () => JSON.stringify({
    risk_level: 'high',
    conflicts: [{ type: 'drug-drug', with: 'Warfarin 5mg', reason: 'Bleeding risk', severity: 'high' }],
    recommendation: 'Avoid or choose safer analgesic.',
  }));

  assert.equal(result.risk_level, 'high');
  assert.equal(result.conflicts[0].with, 'Warfarin 5mg');
  assert.equal(result._disclaimer.toLowerCase().includes('verify'), true);
});

test('drug checker rejects malformed JSON', async () => {
  await assert.rejects(checkDrugConflicts({ new_drug: 'Test' }, async () => 'oops'), /JSON object/);
});

test('drug checker route returns 503 when feature flag is false', async () => {
  const previous = process.env.AI_FEATURE_DRUG_CHECKER;
  process.env.AI_FEATURE_DRUG_CHECKER = 'false';
  const res = createRes();

  await handler({ method: 'POST', headers: {}, body: { new_drug: 'Ibuprofen 400mg' } } as any, res as any);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'feature_disabled', message: 'AI drug checker is disabled' });
  process.env.AI_FEATURE_DRUG_CHECKER = previous;
});
