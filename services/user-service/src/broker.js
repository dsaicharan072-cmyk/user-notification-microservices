const fs = require('fs');
const { connect, credsAuthenticator, StringCodec } = require('nats');
const config = require('./config');
const sc = StringCodec();
let js;

async function connectBroker() {
  const options = { servers: config.NATS_URL, name: 'user-service', maxReconnectAttempts: -1 };
  if (config.NATS_CREDS_FILE) options.authenticator = credsAuthenticator(fs.readFileSync(config.NATS_CREDS_FILE));
  else if (config.NATS_USER) { options.user = config.NATS_USER; options.pass = config.NATS_PASSWORD; }
  if (config.NATS_TLS_CA) options.tls = { caFile: config.NATS_TLS_CA };
  const nc = await connect(options);
  js = nc.jetstream();
  const jsm = await nc.jetstreamManager();
  try { await jsm.streams.add({ name: 'USER_EVENTS', subjects: ['users.>'], storage: 'file', retention: 'limits', max_age: 604800000000000 }); } catch (error) { if (!/already in use|already exists/i.test(error.message)) throw error; }
  return nc;
}

async function publish(subject, event) { await js.publish(subject, sc.encode(JSON.stringify(event))); }
module.exports = { connectBroker, publish };
