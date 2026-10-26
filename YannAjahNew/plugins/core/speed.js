'use strict';
const { feature } = require('../../library/plugin-kit');
const { bytesToSize } = require('../../library/function');

module.exports = feature({ id: 'core.speed', name: 'speed', aliases: ['server'], category: 'core', description: 'Info server: CPU, memori, platform',
  async run(ctx) {
    const os = require('os');
    await ctx.reply([`Platform: ${os.platform()} ${os.arch()}`, `CPU: ${os.cpus()[0]?.model || '?'} × ${os.cpus().length}`, `Load: ${os.loadavg().map(x => x.toFixed(2)).join(' ')}`, `RAM: ${bytesToSize(os.totalmem() - os.freemem())} / ${bytesToSize(os.totalmem())}`, `Proses: ${bytesToSize(process.memoryUsage().rss)}`].join('\n'));
  } });
