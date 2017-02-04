const createAnimation = require('./animate').createAnimation;
const find = require('./find');
const upload = require('./upload');

const width = 450;
const height = 300;

let startTime = Date.now();
let params = find({width, height});
console.log(`Found point after ${Math.round((Date.now() - startTime) / 1000)}s`);

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

createAnimation(params)
.then((outputFile) => {
  let seconds = Math.round((Date.now() - startTime) / 1000);
  console.log(`${outputFile} completed after ${seconds}s`);

  return upload(outputFile);
})
.then((url) => {
  console.log(`Gif uploaded to ${url}`);
  console.log('Waiting until next hour to tweet');
  return waitUntilTweetTime().then(() => tweetImage(params, url));
})
.catch((err) => {
  console.error(err);
  console.error(`Errored after ${Date.now() - startTime}ms`);
  process.exit(1);
});