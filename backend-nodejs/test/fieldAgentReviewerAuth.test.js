import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

import { fieldAgentReviewerAuth } from '../src/middleware/fieldAgentReviewerAuth.js';

const app = express();
app.use(fieldAgentReviewerAuth);
app.get('/review-test', (req, res) => {
  res.status(200).json({ success: true });
});

test('rejects reviewer requests without authentication', async () => {
  const response = await request(app).get('/review-test');

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, 'Authentication required.');
});

test('rejects reviewer requests when MongoDB is unavailable', async () => {
  const originalReadyState = mongoose.connection.readyState;
  const originalJwtSecret = process.env.JWT_SECRET;

  try {
    process.env.JWT_SECRET = 'reviewer-test-secret';
    mongoose.connection.readyState = 0;

    const response = await request(app)
      .get('/review-test')
      .set('Authorization', 'Bearer test-token');

    assert.equal(response.status, 503);
    assert.equal(response.body.success, false);
    assert.equal(
      response.body.message,
      'Authentication database is unavailable.',
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  }
});