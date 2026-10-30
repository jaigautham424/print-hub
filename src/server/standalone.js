const { startServer, stopServer, getPort } = require('./index');
const { getLocalIP } = require('../utils/network');

console.log('\n  Print Hub - Starting Server...');
console.log('  ================================\n');

startServer(null).then(() => {
  const port = getPort();
  console.log(`\n  Dashboard: http://localhost:${port}`);
  console.log(`  Network:   http://${getLocalIP()}:${port}`);
  console.log('\n  Press Ctrl+C to stop\n');
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

async function shutdown() {
  console.log('\n  Shutting down...');
  try { await stopServer(); } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
