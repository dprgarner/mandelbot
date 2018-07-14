const fs = require('fs');
const path = require('path');

const _ = require('underscore');
const chroma = require('chroma-js');
const md5 = require('md5');
const Color = require('color');
const JPEGDecoder = require('jpg-stream/decoder');
const request = require('request');
const rimraf = require('rimraf');
const toArray = require('stream-to-array');
const winston = require('winston');

const {OUTPUT_DIR, LIVE} = require('./env');
const latestReplyFile = path.join(OUTPUT_DIR, 'latestReply.txt');
const {constructSet, renderSetToFile} = require('./mandelbrot');
const {getPopularColourSchemes, replyWithImage} = require('./twitter');

function getColours({id, url}) {
  const fileName = `./${id}.jpg`;
  return new Promise((resolve, reject) => {
    request(url)
    .pipe(fs.createWriteStream(fileName))
    .on('finish', err => {
      if (err) return reject(err);
      resolve(fileName);
    })
  })
  .then(() => {
    return toArray(
      fs.createReadStream(fileName)
      .pipe(new JPEGDecoder)
    );
  })
  .then(data => {
    rimraf.sync(fileName);
    coloursCount = {};
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[0].length; j+=3) {
        let c = Color([data[i][j], data[i][j+1], data[i][j+2]]).hex();
        coloursCount[c] = 1 + (coloursCount[c] || 0);
      }
    }

    let colours = _.chain(coloursCount)
    .pairs()
    .sortBy(v => -v[1])
    .first(3)
    .map(v => v[0])
    .map(Color)
    .value();
    return colours;
  });
}

function renderFromColours(colours) {
  let params = {
    width: 512,
    height: 512,
    x: -0.5,
    y: 0,
    scale: Math.pow(2, -7),
    depth: 200,
    colours: {
      sparse: colours[0].rgb().array(),
      dense: colours[2].rgb().array(),
      mandelbrot: colours[1].rgb().array(),
      mode: 'sparse',
    },
  };
  console.log(params.colours);
  let set = constructSet(params);
  const fileName = md5(Date.now()).substr(0, 12);
  const outputFile = `${OUTPUT_DIR}/cs_${fileName}.gif`;
  return renderSetToFile(set, params, outputFile);
}

module.exports = function pinchColourScheme() {
  winston.info('Attempting to tweet at a colour scheme');

  return getPopularColourSchemes()
  .then(tweets => {
    winston.info(`Found ${tweets.length} potential colour scheme tweets`);
    console.log(tweets);
    function getContrastingColours(subTweets) {
      if (!subTweets.length) return false;
      return getColours(subTweets[0])
      .then((colours) => {
        // test whether contrast is good
        const contrast1 = chroma.contrast(colours[2].hex(), colours[0].hex()) / 3;
        const contrast2 = chroma.contrast(colours[1].hex(), colours[2].hex()) / 2;

        if (contrast1 > 1 && contrast2 > 1) {
          winston.info(`Accepted contrasts of tweet ${subTweets[0].id}`);
          return _.extend({}, subTweets[0], {colours});
        } else {
          winston.info(`Rejected contrasts of tweet ${subTweets[0].id}`);
          return getContrastingColours(_.tail(subTweets));
        }
      });
    }

    return getContrastingColours(tweets);
  })
  .then(tweet => {
    if (!tweet) {
      winston.info('No eligible tweets');
      return;
    }

    fs.writeFileSync(latestReplyFile, Date.now());
    winston.debug(tweet);

    let status = '@colorschemez ';
    status += 'I think this makes a good colour scheme for a Mandelbrot set.';

    return renderFromColours(tweet.colours)
    .then((f) => {
      return (LIVE ? replyWithImage(f, status, tweet.id) : null);
    })
  })
  .then(x => {
    winston.info(`Tweeted @colourschemez: ${x}`);
    return x;
  });
}
