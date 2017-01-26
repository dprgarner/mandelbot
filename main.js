'use strict';

const fs = require('fs');
const http = require('http');
const stream = require('stream');
const url = require('url');

const _  = require('underscore');
const neuquant = require('neuquant');
const GIFEncoder = require('gif-stream/encoder');
const PNGEncoder = require('png-stream/encoder');

const constructSet = require('./mandelbrot').constructSet;
const drawMandelbrot = require('./mandelbrot').drawMandelbrot;
const getAnimatedStream = require('./animate').getAnimatedStream;
const generateKeyframeImages = require('./animate').generateKeyframeImages;

const PORT = 80;

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

  let startTime = Date.now();
  let set = constructSet(params);
  console.log(`Set constructed after ${Date.now() - startTime}ms`);

  let s = drawMandelbrot(set, params.depth);

  res.writeHead(200, {'Content-Type': 'image/png'});

  s.pipe(new PNGEncoder(params.width, params.height, {colorSpace: 'rgb'}))
  .pipe(res)
  .on('finish', function () {
    console.log(`Finished after ${Date.now() - startTime}ms`);
  });
}

function apiGif(queryDict, res) {
  let startTime = Date.now();

  const width = 900 / 2;
  const height = 600 / 2;
  const levels = 22;
  const x = -0.30240590;
  const y = 0.66221035;

  let params = {width, height, x, y, levels};

  getAnimatedStream(params)
  .then((outputFile) => {
    res.writeHead(200, {'Content-Type': 'image/gif'});
    fs.createReadStream(outputFile)
    .pipe(res)
    .on('finish', () => {
      console.log(`Finished after ${Date.now() - startTime}ms`);
    });
  })
  .catch((err) => {
    console.error.bind(console)
    res.status(500).end(err);
  });

  // let s = drawMandelbrot(constructSet(params), params.depth);
  // res.writeHead(200, {'Content-Type': 'image/gif'});

  // s.pipe(new neuquant.Stream(params.width, params.height, {colorSpace: 'rgb'}))
  // .pipe(new GIFEncoder)
  // .pipe(res)
  // .on('finish', function () {
  // });
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