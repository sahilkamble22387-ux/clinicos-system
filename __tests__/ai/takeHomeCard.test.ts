import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/ai/patient-card.ts';
import { generateTakeHomeCardContent } from '../../lib/ai/features/takeHomeCard.ts';

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

const sampleInput = {
  front_desk_id: 'P-TEST-01',
  language: 'hindi' as const,
  age: 54,
  gender: 'Male',
  diagnosis_today: 'High Blood Pressure',
  prescriptions: [
    { drug: 'Telmisartan 40mg', frequency: 'Once daily morning', duration: '30 days', instructions: 'Take with water' },
  ],
};

test('patient card uses mocked callAI', async () => {
  const result = await generateTakeHomeCardContent(sampleInput, async () => JSON.stringify({
    title: 'Aapki Dawaiyan',
    intro: 'Aaj ki visit ki jaankari.',
    medications: [{ drug_simple_name: 'BP ki dawai', why: 'BP control ke liye', how: 'Subah lein', warning: 'Na rokein' }],
    lifestyle_tips: ['Namak kam karein'],
    follow_up: '30 din baad aaiye',
    footer: 'Doctor se poochh-taachh zaroor karein.',
  }));

  assert.equal(result.medications[0].drug_simple_name, 'BP ki dawai');
  assert.equal(result._disclaimer.toLowerCase().includes('verify'), true);
});

test('patient card rejects malformed JSON', async () => {
  await assert.rejects(generateTakeHomeCardContent(sampleInput, async () => 'nope'), /JSON object/);
});

test('patient card route returns 503 when feature flag is false', async () => {
  const previous = process.env.AI_FEATURE_PATIENT_CARD;
  process.env.AI_FEATURE_PATIENT_CARD = 'false';
  const res = createRes();

  await handler({ method: 'POST', headers: {}, body: sampleInput } as any, res as any);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'feature_disabled', message: 'AI patient card is disabled' });
  process.env.AI_FEATURE_PATIENT_CARD = previous;
});
