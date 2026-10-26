'use strict';
// Banner terminal YANNZAJAH / YannAjahNew (ASCII "ANSI Shadow").
const chalk = require('chalk');

const ART = [
  '██╗   ██╗ █████╗ ███╗   ██╗███╗   ██╗███████╗ █████╗      ██╗ █████╗ ██╗  ██╗',
  '╚██╗ ██╔╝██╔══██╗████╗  ██║████╗  ██║╚══███╔╝██╔══██╗     ██║██╔══██╗██║  ██║',
  ' ╚████╔╝ ███████║██╔██╗ ██║██╔██╗ ██║  ███╔╝ ███████║     ██║███████║███████║',
  '  ╚██╔╝  ██╔══██║██║╚██╗██║██║╚██╗██║ ███╔╝  ██╔══██║██   ██║██╔══██║██╔══██║',
  '   ██║   ██║  ██║██║ ╚████║██║ ╚████║███████╗██║  ██║╚█████╔╝██║  ██║██║  ██║',
  '   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝'
];
const COLORS = ['#ffd966', '#ffcf4d', '#ffc233', '#f5b31f', '#e9a514', '#d9960d'];

function banner({ version, botName, instance } = {}) {
  const lines = ART.map((l, i) => chalk.hex(COLORS[i])(l));
  const sub = chalk.bold.white(`  YannAjahNew v${version || '?'}`) + chalk.gray(`  ·  ${botName || ''}  ·  instance ${instance || '-'}`);
  return `\n${lines.join('\n')}\n${sub}\n${chalk.gray('  ' + '─'.repeat(74))}\n`;
}

module.exports = { banner, ART };
