const _ = require('underscore');

const find = require('./find');
const renderSetToFile = require('./mandelbrot').renderSetToFile;
const constructSet = require('./mandelbrot').constructSet;
const randomColours = require('./mandelbrot').randomColours;

function render(set, params, fileName) {
  renderSetToFile(set, params, fileName)
  .then((frameLocation) => {
    console.log(`Outputted keyFrame to ${frameLocation}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

const width = 504;
let approxHeight = Math.floor(width * 2 / 3);
const height = approxHeight + approxHeight % 2; // Height must be divisible by 2

let params = _.extend({}, find({width: 150, height: 100}), {
  width,
  height,
  colours: randomColours(),
});
let set = constructSet(params);
render(set, params, '02.gif');
params = _.extend({}, params, {scale: Math.pow(2, -8)});
set = constructSet(params);
render(set, params, '01.gif')