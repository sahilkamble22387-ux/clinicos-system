import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/ai/soap-note.ts';
import { generateSoapNote } from '../../lib/ai/features/soapScribe.ts';

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

test('SOAP scribe uses mocked callAI', async () => {
  const result = await generateSoapNote('Patient has fever, advised fluids.', async () => JSON.stringify({
    soap: {
      subjective: 'Fever',
      objective: 'No vitals mentioned',
      assessment: 'Likely viral fever',
      plan: 'Fluids and follow-up',
    },
    confidence: 'high',
    flag: null,
  }));

  assert.equal(result.soap.assessment, 'Likely viral fever');
  assert.equal(result._disclaimer.toLowerCase().includes('verify'), true);
});

test('SOAP scribe rejects malformed JSON', async () => {
  await assert.rejects(generateSoapNote('test', async () => '<html />'), /JSON object/);
});

test('SOAP route returns 503 when feature flag is false', async () => {
  const previous = process.env.AI_FEATURE_SCRIBE;
  process.env.AI_FEATURE_SCRIBE = 'false';
  const res = createRes();

  await handler({ method: 'POST', headers: {}, body: { transcript: 'P-TEST-01 visit note' } } as any, res as any);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'feature_disabled', message: 'AI SOAP scribe is disabled' });
  process.env.AI_FEATURE_SCRIBE = previous;
});
