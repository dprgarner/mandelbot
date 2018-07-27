const fs = require('fs');
const {execFileSync} = require('child_process');

const _ = require('underscore');
const findRemoveSync = require('find-remove');
const winston = require('winston');

const createGif = require('./animate').createGif;
const createMp4 = require('./animate').createMp4;
const gifsicle = require('./animate').gifsicle;
const find = require('./find');
const randomColours = require('./mandelbrot').randomColours;
const uploadVimeo = require('./uploadVimeo');
const uploadGfycat = require('./uploadGfycat');
const {uploadMedia, updateStatus, tweetWithImages} = require('./twitter');
const {OUTPUT_DIR, LIVE, TEST, ALLOW_VIDEO, INSTANT} = require('./env');
const pinchColourScheme = require('./pinchColourScheme');

function waitUntilDueTime() {
  // Possibly tweet at another bot while waiting for a tweet window.
  return Promise.resolve(true)
  .then(() => (Math.random() < 0.25) ? pinchColourScheme() : true)
  .then(() => new Promise((resolve, reject) => {
    // Wait until the next three-hour point.
    let tweetInterval = 1000 * 60 * 60 * 2;
    let msUntilTime = tweetInterval - (Date.now() % tweetInterval);
    setTimeout(resolve, INSTANT ? 0 : msUntilTime);
  }));
}

require('./initialiseLogging')();

const deletedFiles = findRemoveSync(OUTPUT_DIR, {
  age: {seconds: 3600 * 24 * 7},
  extensions: ['.gif', '.txt'],
  maxLevel: 1,
});
winston.debug(`Deleted: ${JSON.stringify(deletedFiles, null, 2)}`);

const width = TEST ? 504 / 2 : 504;
const approxHeight = Math.floor(width * 2 / 3);
const height = approxHeight + approxHeight % 2; // Height must be divisible by 2
const colours = randomColours();

let startTime = Date.now();
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
  // Upload a vimeo video
  createMp4(params)
  .then((outputFile) => {
    let seconds = Math.round((Date.now() - startTime) / 1000);
    winston.info(`${outputFile} completed after ${seconds}s`);

    if (LIVE) {
      return uploadVimeo(outputFile)
      .then((url) => {
        winston.info(
          `Successfully uploaded video to ${url}. Waiting until next opportunity to tweet`
        );
        return waitUntilDueTime()
        .then(() => updateStatus({status: url}));
      })
      .then((tweetUrl) => {
        winston.info(`Tweeted: ${tweetUrl}`);
        process.exit(0);
      });
    }
  })
  .catch((err) => {
    winston.error(err);
    winston.error(`Errored after ${Date.now() - startTime}ms`);
    process.exit(1);
  });
} else {
  // Upload a GIF to gfycat with four keyframe images
  createGif(params)
  .then((outputFile) => {
    let seconds = Math.round((Date.now() - startTime) / 1000);
    winston.info(`${outputFile} completed after ${seconds}s`);

    if (LIVE) {
      return uploadGfycat(outputFile)
      .then((url) => {
        winston.info(
          `Successfully uploaded GIF to ${url}. Waiting until next opportunity to tweet`
        );
        const stillImages = _.range(4).map(i => (
          `./frames/key-${Math.round((params.levels - 1) * i / 3)}.gif`
        ));
        const status = `High-resolution GIF here: ${url}`

        return waitUntilDueTime()
        .then(() => tweetWithImages(stillImages, status));
      })
      .then((tweetUrl) => {
        winston.info(`Tweeted: ${tweetUrl}`);
        process.exit(0);
      });
    }
  })
  .catch((err) => {
    winston.error(err);
    winston.error(`Errored after ${Date.now() - startTime}ms`);
    process.exit(1);
  });
}
