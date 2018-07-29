const _ = require('underscore');

const find = require('./find');
const renderSetToFile = require('./mandelbrot').renderSetToFile;
const constructSet = require('./mandelbrot').constructSet;
const randomColours = require('./mandelbrot').randomColours;
const winston = require('winston');

require('./initialiseLogging')();

function render(set, params, fileName) {
  return renderSetToFile(set, params, fileName)
  .then((frameLocation) => {
    winston.debug(`Outputted keyFrame to ${frameLocation}`);
  })
  .catch((err) => {
    winston.error(err);
    process.exit(1);
  });
}

const serial = funcs => funcs.reduce(
  (promise, func) => promise.then(result =>
    func().then(Array.prototype.concat.bind(result))
  ),
  Promise.resolve([])
);

const width = 504;
let approxHeight = Math.floor(width * 2 / 3);
const height = approxHeight + approxHeight % 2; // Height must be divisible by 2

let foundParams = find({width: 150, height: 100});

serial(_.map(_.range(20), i => () => {
  let params = _.extend({}, foundParams, {
    width,
    height,
    colours: _.extend(randomColours(), {mode: 'normal'}),
  });
  let set = constructSet(params);
  return render(set, params, `./ct/${(i < 10) ? '0' + i : i}B.gif`)
  .then(() => {
    params = _.extend({}, params, {scale: Math.pow(2, -8)});
    set = constructSet(params);
    return render(set, params, `./ct/${(i < 10) ? '0' + i : i}A.gif`);
  });
}));
