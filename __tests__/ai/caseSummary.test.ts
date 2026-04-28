import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/ai/case-summary.ts';
import { generateCaseSummary } from '../../lib/ai/features/caseSummary.ts';
import { sanitizeForAI, PATIENT_SAFE_KEYS } from '../../lib/ai/sanitize.ts';

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

test('sanitizeForAI strips patient PII keys', () => {
  const safe = sanitizeForAI({
    front_desk_id: 'P-TEST-01',
    age: 54,
    patient_name: 'Test Patient',
    phone_number: '9999999999',
    email: 'test@example.com',
  }, PATIENT_SAFE_KEYS as readonly (keyof {
    front_desk_id: string;
    age: number;
    patient_name: string;
    phone_number: string;
    email: string;
  })[]);

  assert.deepEqual(safe, { front_desk_id: 'P-TEST-01', age: 54 });
});

test('case summary uses mocked callAI and returns disclaimer', async () => {
  const result = await generateCaseSummary({
    front_desk_id: 'P-TEST-01',
    age: 54,
    gender: 'Male',
    diagnoses: ['Hypertension'],
  }, async () => JSON.stringify({ summary: 'P-TEST-01 has hypertension with recent follow-up needs.' }));

  assert.equal(result.summary.includes('hypertension'), true);
  assert.equal(result._disclaimer.toLowerCase().includes('verify'), true);
});

test('case summary rejects malformed JSON', async () => {
  await assert.rejects(
    generateCaseSummary({ front_desk_id: 'P-TEST-01' }, async () => 'not json'),
    /JSON object/
  );
});

test('case summary route returns 503 when feature flag is false', async () => {
  const previous = process.env.AI_FEATURE_SUMMARIZER;
  process.env.AI_FEATURE_SUMMARIZER = 'false';
  const res = createRes();

  await handler({ method: 'POST', headers: {}, body: { frontDeskId: 'P-TEST-01' } } as any, res as any);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'feature_disabled', message: 'AI case summarizer is disabled' });
  process.env.AI_FEATURE_SUMMARIZER = previous;
});
