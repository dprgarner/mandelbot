const fs = require('fs');

const OUTPUT_DIR = process.env.OUTPUT_DIR;

if (!OUTPUT_DIR) {
  console.error('No OUTPUT_DIR specified');
  process.exit(1);
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

exports.TEST = !!(process.env.TEST || '').trim();
exports.LIVE = !!(process.env.LIVE || '').trim();
exports.OUTPUT_DIR = OUTPUT_DIR;
