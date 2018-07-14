const _ = require('underscore');
const winston = require('winston');

const createMp4 = require('./animate').createMp4;
const find = require('./find');
const {randomColours} = require('./mandelbrot');
const {TEST} = require('./env');

const width = TEST ? 504 / 4 : 504;
const approxHeight = Math.floor(width * 2 / 3);
const height = approxHeight + approxHeight % 2; // Height must be divisible by 2

require('./initialiseLogging')();

let startTime = Date.now();
let params = _.extend({}, find({width: 150, height: 100}), {
  width,
  height,
  colours: _.extend(randomColours()),
});

if (TEST) params.levels = 12;
winston.debug(`Found point after ${Math.round((Date.now() - startTime) / 1000)}s`);

// Create trial video
createMp4(params)
.then((outputFile) => {
  let seconds = Math.round((Date.now() - startTime) / 1000);
  winston.debug(`${outputFile} completed after ${seconds}s`);
})
.catch((err) => {
  winston.error(err);
  winston.error(`Errored after ${Date.now() - startTime}ms`);
  process.exit(1);
});
