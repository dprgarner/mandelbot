const fs = require('fs');
const GIFEncoder = require('gif-stream/encoder');
const neuquant = require('neuquant');

const constructSet = require('./mandelbrot').constructSet;
const renderSetToFile = require('./mandelbrot').renderSetToFile;

const level = 6;
const params = {
  x: -0.105,
  y: 0.895,
  scale: Math.pow(2, -7 - level),
  depth: 500,
  width: 450,
  height: 300,
  level,
};

let startTime = Date.now();
console.log(`Constructing Mandelbrot set...`);
let set = constructSet(params);
console.log(`Constructed Mandelbrot set after ${Date.now() - startTime}ms`);

const frameLocation = `./frames/${params.level}_${params.x}_${params.y}.gif`;

renderSetToFile(set, params, frameLocation)
.then((frameLocation) => {
  console.log(`Outputted keyFrame to ${frameLocation}`);
})
.catch((err) => {
  console.error(err);
  process.exit(1);
});
