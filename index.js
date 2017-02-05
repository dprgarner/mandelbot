const _ = require('underscore');

const createGif = require('./animate').createGif;
const createMp4 = require('./animate').createMp4;
const find = require('./find');
const uploadGfycat = require('./uploadGfycat');
const {uploadMedia, updateStatus} = require('./twitter');

function waitUntilDueTime() {
  return new Promise((resolve, reject) => {
    let d = new Date();
    // Wait until the next hour.
    let msUntilHour = 1000 * (60 * (60 - d.getMinutes()) + (60 - d.getSeconds()));
    setTimeout(resolve, 2000);
  });
}

function tweetGifWithImages({levels}, url) {
  let stillImages = _.range(4).map(i => (
    `./frames/key-${Math.round((levels - 1) * i / 3)}.gif`
  ));

  return Promise.all(_.map(stillImages, uploadMedia))
  .then((mediaIds) => {
    let params = {status: `GIF: ${url}`, media_ids: mediaIds}
    return updateStatus(params)
  })
  .then(({id_str}) => `https://twitter.com/BenoitMandelbot/status/${id_str}`);
}

const width = 504;
let approxHeight = Math.floor(width * 2 / 3);
const height = approxHeight + approxHeight % 2; // Height must be divisible by 2

let startTime = Date.now();
let params = _.extend({}, find({width: 150, height: 100}), {width, height});
console.log(`Found point after ${Math.round((Date.now() - startTime) / 1000)}s`);

createGif(params)
.then((outputFile) => {
  let seconds = Math.round((Date.now() - startTime) / 1000);
  console.log(`${outputFile} completed after ${seconds}s`);

  return uploadGfycat(outputFile);
})
.then((url) => {
  console.log(`Successfully uploaded to ${url}`)
  console.log('Waiting until next hour to tweet');
  return waitUntilDueTime().then(() => tweetGifWithImages(params, url));
})
.then((tweetUrl) => {
  console.log(`Tweet: ${tweetUrl}`);
})
.catch((err) => {
  console.error(err);
  console.error(`Errored after ${Date.now() - startTime}ms`);
  process.exit(1);
});