const _ = require('underscore');
const findRemoveSync = require('find-remove');
const winston = require('winston');

const createAndTweetGif = require('./createAndTweetGif');
const createAndTweetVideo = require('./createAndTweetVideo');

const find = require('./find');
const randomColours = require('./mandelbrot').randomColours;
const {OUTPUT_DIR, TEST, ALLOW_VIDEO} = require('./env');

require('./initialiseLogging')();

function clean() {
  const deletedFiles = findRemoveSync(OUTPUT_DIR, {
    age: {seconds: 3600 * 24 * 7},
    extensions: ['.gif', '.txt'],
    maxLevel: 1,
  });
  winston.debug(`Deleted: ${JSON.stringify(deletedFiles, null, 2)}`);
}

function runBot() {
  try {
    let startTime = Date.now();

    clean();

    const width = TEST ? 504 / 2 : 504;
    const approxHeight = Math.floor(width * 2 / 3);
    const height = approxHeight + approxHeight % 2; // Height must be divisible by 2
    const colours = randomColours();

    let params = _.extend({}, find({width: 150, height: 100}), {
      width,
      height,
      colours,
    });

    if (TEST) params.levels = 8;
    winston.debug(`Found point after ${Math.round((Date.now() - startTime) / 1000)}s`);
    winston.info(JSON.stringify(params, null, 2));

    // Usually return a GIF, so we don't hit Vimeo's upload limit
    if (Math.random() < 0.25 && ALLOW_VIDEO) {
      return createAndTweetVideo(params);
    } else {
      return createAndTweetGif(params);
    }
  } catch(e) {
    return Promise.reject(e);
  }
}

let totalTime = Date.now();
runBot()
  .then((tweetUrl) => {
    winston.info(`Tweeted: ${tweetUrl}`);
    process.exit(0);
  })
  .catch((err) => {
    winston.error(err);
    winston.error(`Errored after ${Date.now() - totalTime}ms`);
    process.exit(1);
  });
