const _ = require('underscore');
const winston = require('winston');

const convertGifsToPng = require('./convertGifsToPng');
const uploadGfycat = require('./uploadGfycat');
const waitWithTweet = require('./waitWithTweet');
const {createGif} = require('./animate');
const {LIVE} = require('./env');
const {tweetWithImages} = require('./twitter');

module.exports = function(params) {
  const startTime = Date.now();

  // Upload a GIF to gfycat with four keyframe images
  return createGif(params)
  .then((outputFile) => {
    let seconds = Math.round((Date.now() - startTime) / 1000);
    winston.info(`${outputFile} completed after ${seconds}s`);

    if (LIVE) {
      return uploadGfycat(outputFile)
      .then((url) => {
        winston.info(
          `Successfully uploaded GIF to ${url}. Waiting until next opportunity to tweet`
        );
        const stillImages = _.range(4).map(i => (
          `./frames/key-${Math.round((params.levels - 1) * i / 3)}.gif`
        ));
        const status = `High-resolution GIF here: ${url}`

        return convertGifsToPng(stillImages)
        .then((pngImages) => (
          waitWithTweet()
          .then(() => tweetWithImages(pngImages, status))
        ))
      })
    }
  })
}
