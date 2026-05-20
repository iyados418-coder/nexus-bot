const chalk = require('chalk');

const timestamp = () => {
  const now = new Date();
  return `[${now.toLocaleDateString()} ${now.toLocaleTimeString()}]`;
};

module.exports = {
  info: (msg) => console.log(`${chalk.blue('[INFO]')} ${timestamp()} ${msg}`),
  success: (msg) => console.log(`${chalk.green('[OK]')} ${timestamp()} ${msg}`),
  warn: (msg) => console.log(`${chalk.yellow('[WARN]')} ${timestamp()} ${msg}`),
  error: (msg) => console.log(`${chalk.red('[ERROR]')} ${timestamp()} ${msg}`),
  divider: () => console.log(chalk.gray('━'.repeat(50))),
};
