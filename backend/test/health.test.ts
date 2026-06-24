import { afterAll, expect, test } from 'vitest';
import { RISK_SCALE_MAX } from '@rap/engine';
import { makeTestApp } from './helpers/app';

const { app, handle } = makeTestApp();
afterAll(async () => {
  await app.close();
  handle.close();
});

test('GET /health exposes the engine risk scale (bundle touchpoint)', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.ok).toBe(true);
  expect(body.engine.riskScaleMax).toBe(RISK_SCALE_MAX);
});
