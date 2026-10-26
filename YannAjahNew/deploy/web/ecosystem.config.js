'use strict';
// pm2: `pm2 start ecosystem.config.js && pm2 save`
module.exports = {
  apps: [{
    name: 'yannajah-web',
    script: 'server/index.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '400M',
    exp_backoff_restart_delay: 5000,
    env: { NODE_ENV: 'production' }
  }]
};
