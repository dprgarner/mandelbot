const fs = require('fs');
const {execFileSync} = require('child_process');

const _ = require('underscore');

const createGif = require('./animate').createGif;
const createMp4 = require('./animate').createMp4;
const gifsicle = require('./animate').gifsicle;
const find = require('./find');
const uploadVimeo = require('./uploadVimeo');
const uploadGfycat = require('./uploadGfycat');
const {uploadMedia, updateStatus} = require('./twitter');
const {LIVE, TEST} = require('./env');

function waitUntilDueTime() {
  return new Promise((resolve, reject) => {
    // Wait until the next three-hour point.
    let tweetInterval = 1000 * 60 * 60 * 2;
    let msUntilTime = tweetInterval - (Date.now() % tweetInterval);
    setTimeout(resolve, msUntilTime);
  });
}

function uploadOptimisedMedia(filePath) {
  let stats = fs.statSync(filePath)
  if (stats.size > 2.5 * 1024 * 1024) {
    execFileSync(gifsicle, [
      '-b', filePath,
      '--colors', '64',
      '--dither',
    ]);
  }
  return uploadMedia(filePath);
}

function tweetGifWithImages({levels}, url) {
  let stillImages = _.range(4).map(i => (
    `./frames/key-${Math.round((levels - 1) * i / 3)}.gif`
  ));

  return Promise.all(_.map(stillImages, uploadOptimisedMedia))
  .then((mediaIds) => {
    let params = {status: `High-resolution GIF here: ${url}`, media_ids: mediaIds}
    return updateStatus(params)
  })
  .then(({id_str}) => `https://twitter.com/BenoitMandelbot/status/${id_str}`);
}

const width = TEST ? 504 / 2 : 504;
const approxHeight = Math.floor(width * 2 / 3);
const height = approxHeight + approxHeight % 2; // Height must be divisible by 2

let startTime = Date.now();
let params = _.extend({}, find({width: 150, height: 100}), {
  width,
  height,
});

if (TEST) params.levels = 8;
console.log(`Found point after ${Math.round((Date.now() - startTime) / 1000)}s`);

// Always return a GIF for the moment.
if (Math.random() < 0.7 || true) {
  // Upload a GIF to gfycat with four keyframe images
  createGif(params)
  .then((outputFile) => {
    let seconds = Math.round((Date.now() - startTime) / 1000);
    console.log(`${outputFile} completed after ${seconds}s`);

    if (LIVE) {
      return uploadGfycat(outputFile)
      .then((url) => {
        console.log(`Successfully uploaded to ${url}`)
        console.log('Waiting until next opportunity to tweet');
        return waitUntilDueTime().then(() => tweetGifWithImages(params, url));
      })
      .then((tweetUrl) => {
        console.log(`Tweet: ${tweetUrl}`);
        process.exit(0);
      });
    }
  })
  .catch((err) => {
    console.error(err);
    console.error(`Errored after ${Date.now() - startTime}ms`);
    process.exit(1);
  }); 
} else {
  // Upload a vimeo video
  createMp4(params)
  .then((outputFile) => {
    let seconds = Math.round((Date.now() - startTime) / 1000);
    console.log(`${outputFile} completed after ${seconds}s`);

    if (LIVE) {
      return uploadVimeo(outputFile)
      .then((url) => {
        console.log(`Successfully uploaded to ${url}`)
        console.log('Waiting until next opportunity to tweet');
        return waitUntilDueTime()
        .then(() => updateStatus({status: url}))
        .then(({id_str}) => `https://twitter.com/BenoitMandelbot/status/${id_str}`);
      })
      .then((tweetUrl) => {
        console.log(`Tweet: ${tweetUrl}`);
        process.exit(0);
      });
    }
  })
  .catch((err) => {
    console.error(err);
    console.error(`Errored after ${Date.now() - startTime}ms`);
    process.exit(1);
  });
}