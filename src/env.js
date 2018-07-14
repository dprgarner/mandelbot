exports.TEST = !!(process.env.TEST || '').trim();
exports.LIVE = !!(process.env.LIVE || '').trim();
exports.OUTPUT_DIR = process.env.OUTPUT_DIR || '.';
