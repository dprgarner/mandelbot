'use strict';

const fs = require('fs');
const http = require('http');
const stream = require('stream');
const url = require('url');

const _  = require('underscore');
const Jimp = require('jimp');
const GIFEncoder = require('gifencoder');
const CombinedStream = require('combined-stream');

const constructSet = require('./mandelbrot').constructSet;
const drawMandelbrot = require('./mandelbrot').drawMandelbrot;
const getKeyframes = require('./animate').getKeyframes;

const PORT = 80;

function pipeImageTo(image, dest) {
  image.getBuffer(Jimp.MIME_PNG, function (err, buffer) {
    if (err) return console.error(err);
    let s = new stream.PassThrough();
    s.end(buffer);
    s.pipe(dest);
  });
}

function getParamsWithDefault(queryDict) {
  let params = _.extend({}, {
    width: 512,
    height: 512,
    x: -0.5,
    y: 0,
    depth: 100,
    scale: 1/128,
  }, queryDict);

  params.width = parseInt(params.width);
  params.height = parseInt(params.height);
  params.depth = parseInt(params.depth);
  params.x = parseFloat(params.x);
  params.y = parseFloat(params.y);
  params.scale = parseFloat(params.scale);

  return params;
}

function apiPng(queryDict, res) {
  let params = getParamsWithDefault(queryDict);

  res.writeHead(200, {'Content-Type': 'image/png'});
  let startTime = Date.now();
  let set = constructSet(params);
  console.log(`Set constructed after ${Date.now() - startTime}ms`);

  drawMandelbrot(set, params.depth, function (err, image) {
    if (err) return console.error(err);
    pipeImageTo(image, res);
  });
}

function apiGif(queryDict, res) {
  let gifWidth = null, gifHeight = null;
  let startTime = Date.now();

  getKeyframes()
  .then((keyframes) => {
    let width = keyframes[0].bitmap.width;
    let height =keyframes[0].bitmap.height;
    gifWidth = width / 2;
    gifHeight = height / 2;

    let frames = [];
    const framesPerLevel = 5;
    const power = Math.exp(Math.log(2) / framesPerLevel);

    _.each(keyframes, (baseImage) => {
      _.each(_.range(framesPerLevel), (i) => {
        let scaledImage = baseImage.clone();
        let newWidth = width * Math.pow(power, i - framesPerLevel);
        let newHeight = height * Math.pow(power, i - framesPerLevel);
        // Jimp.RESIZE_BEZIER Looks better, but is really slow.
        scaledImage.resize(
          newWidth, Jimp.AUTO, Jimp.RESIZE_NEAREST_NEIGHBOR
        );
        scaledImage.crop(
          (newWidth - gifWidth) / 2,
          (newHeight - gifHeight) / 2,
          gifWidth,
          gifHeight
        );
        frames.push(scaledImage)
        console.log(`Drawn frames ${i} after ${Date.now() - startTime}ms`);
      });
    });

    return frames;
  })
  .then((frames) => {
    console.log('Combining frames...');
    let combined = CombinedStream.create();

    _.each(frames, (frame) => {
      let s = new stream.PassThrough();
      s.end(frame.bitmap.data);
      combined.append(s);
    });

    return combined;
  })
  .then((stream) => {
    console.log('Creating gif...');
    let encoder = new GIFEncoder(gifWidth, gifHeight);
    res.writeHead(200, {'Content-Type': 'image/gif'});

    stream
    .pipe(encoder.createWriteStream({repeat: 0, delay: 0}))
    .pipe(res)
    .on('finish', function () {
      console.log(`Rendered after ${Date.now() - startTime}ms`);
    });
  })
  .catch((err) => {
    console.error(err);
    return res.end(err.message);
  });
}

// Server
http.createServer((req, res) => {
  function serveStatic(res, contentType, filePath) {
    res.writeHead(200, {'Content-Type': contentType});
    fs.createReadStream(filePath).pipe(res);
  }

  let reqDict = url.parse(req.url, true);

  switch (reqDict.pathname) {
    case '/png/':
      return apiPng(reqDict.query, res);
    case '/gif/':
      return apiGif(reqDict.query, res);
    case '/elm.js':
      return serveStatic(res, 'text/javascript', './elm.js');
    case '/style.css':
      return serveStatic(res, 'text/css', './style.css');
    default:
      return serveStatic(res, 'text/html', './index.html');
  }
}).listen(PORT);

console.log(`Server listening on port ${PORT}`)