const winston = require('winston');

const uploadVimeo = require('./uploadVimeo');
const waitWithTweet = require('./waitWithTweet');
const {createMp4} = require('./animate');
const {LIVE} = require('./env');
const {updateStatus} = require('./twitter');

module.exports = function(params) {
  const startTime = Date.now();

  // Upload a vimeo video
  return createMp4(params)
  .then((outputFile) => {
    let seconds = Math.round((Date.now() - startTime) / 1000);
    winston.info(`${outputFile} completed after ${seconds}s`);

    if (LIVE) {
      return uploadVimeo(outputFile)
      .then((url) => {
        winston.info(
          `Successfully uploaded video to ${url}. Waiting until next opportunity to tweet`
        );
        return waitWithTweet()
        .then(() => updateStatus({status: url}));
      })
    }
  });
}
