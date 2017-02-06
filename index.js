const fs = require('fs');
const {execFileSync} = require('child_process');

const _ = require('underscore');

const createGif = require('./animate').createGif;
const createMp4 = require('./animate').createMp4;
const gifsicle = require('./animate').gifsicle;
const find = require('./find');
const uploadGfycat = require('./uploadGfycat');
const {uploadMedia, updateStatus} = require('./twitter');

function waitUntilDueTime() {
  return new Promise((resolve, reject) => {
    // Wait until the next two-hour point.
    let twoHours = 1000 * 60 * 60 * 2;
    let msUntilTime = twoHours - (Date.now() % twoHours);
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
    let params = {status: `Full resolution GIF: ${url}`, media_ids: mediaIds}
    return updateStatus(params)
  })
  .then(({id_str}) => `https://twitter.com/BenoitMandelbot/status/${id_str}`);
}

const width = 504;
let approxHeight = Math.floor(width * 2 / 3);
const height = approxHeight + approxHeight % 2; // Height must be divisible by 2

let startTime = Date.now();
let params = _.extend({}, find({width: 150, height: 100}), {
  width,
  height,
});
console.log(`Found point after ${Math.round((Date.now() - startTime) / 1000)}s`);

createGif(params)
.then((outputFile) => {
  let seconds = Math.round((Date.now() - startTime) / 1000);
  console.log(`${outputFile} completed after ${seconds}s`);
  // return uploadGfycat(outputFile);
})
// .then((url) => {
//   console.log(`Successfully uploaded to ${url}`)
//   console.log('Waiting until next hour to tweet');
//   return waitUntilDueTime().then(() => tweetGifWithImages(params, url));
// })
// .then((tweetUrl) => {
//   console.log(`Tweet: ${tweetUrl}`);
//   process.exit(0);
// })
.catch((err) => {
  console.error(err);
  console.error(`Errored after ${Date.now() - startTime}ms`);
  process.exit(1);
});

// createMp4(params)
// .catch((err) => {
//   console.error(err);
//   console.error(`Errored after ${Date.now() - startTime}ms`);
//   process.exit(1);
// });