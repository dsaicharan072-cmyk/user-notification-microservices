const { randomUUID } = require('crypto');
const { pool } = require('./database');
const { publish } = require('./broker');

async function flushOutbox(logger) {
  const { rows } = await pool.query(`SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 100`);
  for (const row of rows) {
    try {
      await publish(row.subject, row.payload);
      await pool.query('UPDATE outbox_events SET published_at = now(), attempts = attempts + 1 WHERE id = $1', [row.id]);
    } catch (error) {
      await pool.query('UPDATE outbox_events SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      logger.error({ err: error, eventId: row.id }, 'outbox publish failed');
    }
  }
}

function startOutbox(logger) { return setInterval(() => flushOutbox(logger).catch(error => logger.error({ err: error }, 'outbox flush failed')), 1000); }
function eventFor(user) { return { id: randomUUID(), type: 'user.created', occurredAt: new Date().toISOString(), data: { id: user.id, email: user.email, name: user.name } }; }
module.exports = { flushOutbox, startOutbox, eventFor };
