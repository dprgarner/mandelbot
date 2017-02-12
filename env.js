exports.TEST = !!(process.env.TEST || '').trim();
exports.LIVE = !!(process.env.LIVE || '').trim();
console.log(process.env.TEST)
exports.OUTPUT_DIR = process.env.OUTPUT_DIR || '.';
exports.DOCKER = process.env.container === 'docker';