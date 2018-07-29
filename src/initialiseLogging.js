const path = require('path');
const winston = require('winston');

const {OUTPUT_DIR, TEST, LIVE} = require('./env');

module.exports = function () {
  winston.level = (TEST) ? 'debug' : 'info';
  winston.add(winston.transports.File, {
    filename: path.join(OUTPUT_DIR, 'log.txt'),
    json: false,
    timestamp: true,
    level: 'debug',
    maxsize: 10 * 1024 * 1024,
  });
  winston.remove(winston.transports.Console);
  winston.add(winston.transports.Console, {'timestamp': true});

  winston.info(`Initialising with TEST=${TEST}, LIVE=${LIVE}...`);
}
