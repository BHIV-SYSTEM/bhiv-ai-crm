import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import fieldAgentRoutes from '../src/routes/fieldAgent.js';

process.env.JWT_SECRET = 'field-agent-test-only-secret';

const app = express();
app.use('/api/field-agent', fieldAgentRoutes);

test('rejects proof uploads without authentication', async () => {
  const response = await request(app)
    .post('/api/field-agent/tasks/test-task/proof')
    .attach('file', Buffer.from('not an image'), {
      filename: 'proof.png',
      contentType: 'image/png',
    });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, 'Authentication required.');
});

test('rejects authenticated-route requests when MongoDB is unavailable', async () => {
  const response = await request(app)
    .post('/api/field-agent/tasks/test-task/proof')
    .set('Authorization', 'Bearer invalid-test-token')
    .attach('file', Buffer.from('small test payload'), {
      filename: 'proof.png',
      contentType: 'image/png',
    });

  assert.equal(response.status, 503);
  assert.equal(response.body.message, 'Authentication database is unavailable.');
});
