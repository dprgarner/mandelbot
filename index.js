const _ = require('underscore');

const createGif = require('./animate').createGif;
const createMp4 = require('./animate').createMp4;
const find = require('./find');
// const upload = require('./upload');

function waitUntilDueTime() {
  return new Promise((resolve, reject) => {
    let d = new Date();
    // Wait until the next hour.
    let msUntilHour = 1000 * (60 * (60 - d.getMinutes()) + (60 - d.getSeconds()));
    setTimeout(resolve, 2000);
  });
}

function tweetImage(params, url) {
  console.log('Tweet: ', url);
  console.log('params:', params)
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

  return Promise.resolve('asdf'); // upload(outputFile);
})
.then((url) => {
  console.log(`Gif uploaded to ${url}`);
  console.log('Waiting until next hour to tweet');
  return waitUntilDueTime().then(() => tweetImage(params, url));
})
.catch((err) => {
  console.error(err);
  console.error(`Errored after ${Date.now() - startTime}ms`);
  process.exit(1);
});