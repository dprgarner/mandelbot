const getAnimatedStream = require('./animate').getAnimatedStream;

const width = 450;
const height = 300;
const levels = 22;
const x = -0.30240589;
const y = 0.66221035;

let params = {width, height, x, y, levels};
let startTime = Date.now();

getAnimatedStream(params)
.then((outputFile) => {
  let seconds = Math.round((Date.now() - startTime) / 1000);
  console.log(`${outputFile} completed after ${seconds}s`);
})
.catch((err) => {
  console.error(err);
  console.error(`Errored after ${Date.now() - startTime}ms`);
  process.exit(1);
});