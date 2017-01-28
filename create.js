const getAnimatedStream = require('./animate').getAnimatedStream;

const width = 900 / 2;
const height = 600 / 2;
const levels = 10;
const x = -0.30240589;
const y = 0.66221035;

let params = {width, height, x, y, levels};
let startTime = Date.now();

getAnimatedStream(params)
.then((outputFile) => {
  console.log(`${outputFile} completed after ${Date.now() - startTime}ms`);
})
.catch((err) => {
  console.error(err);
  console.error(`Errored after ${Date.now() - startTime}ms`);
});