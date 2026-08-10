const fs = require('fs'); const { randomUUID } = require('crypto'); const { connect, credsAuthenticator, StringCodec, AckPolicy, DeliverPolicy } = require('nats');
const config = require('./config'); const { pool } = require('./database'); const sc = StringCodec();
async function startConsumer(logger) {
  const options = { servers: config.NATS_URL, name: 'notification-service', maxReconnectAttempts: -1 };
  if (config.NATS_CREDS_FILE) options.authenticator = credsAuthenticator(fs.readFileSync(config.NATS_CREDS_FILE)); else if (config.NATS_USER) { options.user = config.NATS_USER; options.pass = config.NATS_PASSWORD; }
  if (config.NATS_TLS_CA) options.tls = { caFile: config.NATS_TLS_CA };
  const nc = await connect(options); const jsm = await nc.jetstreamManager();
  try { await jsm.consumers.add('USER_EVENTS', { durable_name: 'notification-user-created-v1', filter_subject: 'users.created', ack_policy: AckPolicy.Explicit, deliver_policy: DeliverPolicy.All, ack_wait: 30000000000, max_deliver: 10 }); } catch (error) { if (!/already exists/i.test(error.message)) throw error; }
  const consumer = await nc.jetstream().consumers.get('USER_EVENTS', 'notification-user-created-v1');
  const messages = await consumer.consume();
  (async () => { for await (const message of messages) { try { const event = JSON.parse(sc.decode(message.data)); const client = await pool.connect(); try { await client.query('BEGIN'); const inserted = await client.query('INSERT INTO processed_events(event_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_id', [event.id]); if (inserted.rowCount) await client.query('INSERT INTO notifications(id,event_id,user_id,recipient,type,status,body) VALUES($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), event.id, event.data.id, event.data.email, 'WELCOME_EMAIL', 'PENDING', { name: event.data.name, message: `Welcome, ${event.data.name}!` }]); await client.query('COMMIT'); message.ack(); logger.info({ eventId: event.id }, 'notification persisted'); } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } } catch (error) { logger.error({ err: error }, 'event handling failed; leaving for redelivery'); message.nak(); } } })().catch(error => logger.fatal({ err: error }, 'consumer stopped'));
  return nc;
}
module.exports = { startConsumer };
