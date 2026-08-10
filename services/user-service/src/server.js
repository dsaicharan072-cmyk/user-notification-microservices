require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const pino = require('pino');
const pinoHttp = require('pino-http');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const config = require('./config');
const { pool, migrate } = require('./database');
const { connectBroker } = require('./broker');
const { flushOutbox, startOutbox, eventFor } = require('./outbox');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const createUser = Joi.object({ email: Joi.string().email().max(254).required(), password: Joi.string().min(12).max(128).required(), name: Joi.string().trim().min(1).max(100).required() });

async function main() {
  await migrate(); await connectBroker(); await flushOutbox(logger); const interval = startOutbox(logger);
  const app = express(); app.disable('x-powered-by'); app.use(helmet()); app.use(express.json({ limit: '16kb' })); app.use(pinoHttp({ logger }));
  app.get('/health', (_, res) => res.json({ status: 'ok' }));
  app.post('/users', async (req, res, next) => {
    try {
      const { value, error } = createUser.validate(req.body, { abortEarly: false, stripUnknown: true });
      if (error) return res.status(400).json({ error: 'VALIDATION_ERROR', details: error.details.map(d => d.message) });
      const user = { id: randomUUID(), email: value.email.toLowerCase(), name: value.name };
      const client = await pool.connect();
      try {
        await client.query('BEGIN'); const hash = await bcrypt.hash(value.password, 12);
        await client.query('INSERT INTO users(id,email,password_hash,name) VALUES($1,$2,$3,$4)', [user.id, user.email, hash, user.name]);
        const event = eventFor(user);
        await client.query('INSERT INTO outbox_events(id,subject,payload) VALUES($1,$2,$3)', [event.id, 'users.created', event]);
        await client.query('COMMIT'); return res.status(201).json({ data: user });
      } catch (error) { await client.query('ROLLBACK'); if (error.code === '23505') return res.status(409).json({ error: 'EMAIL_EXISTS' }); throw error; } finally { client.release(); }
    } catch (error) { next(error); }
  });
  app.use((error, _req, res, _next) => { logger.error({ err: error }, 'request failed'); res.status(500).json({ error: 'INTERNAL_ERROR' }); });
  const server = app.listen(config.USER_SERVICE_PORT, () => logger.info(`User Service listening on ${config.USER_SERVICE_PORT}`));
  const stop = async () => { clearInterval(interval); server.close(); await pool.end(); process.exit(0); }; process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
main().catch(error => { logger.fatal({ err: error }, 'startup failed'); process.exit(1); });
