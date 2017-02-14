const fs = require('fs');

const Twit = require('twit');
const winston = require('winston');

const {twitterAuth} = require('./auth');

var client = new Twit(twitterAuth);

exports.uploadMedia = function(filePath) {
  return new Promise((resolve, reject) => {
    client.postMediaChunked({file_path: filePath}, (err, data, _response) => {
      if (err) return reject(err);
      winston.debug('Uploaded ' + filePath);
      resolve(data.media_id_string);
    });
  });
};

exports.updateStatus = function(params) {
  return new Promise((resolve, reject) => {
    client.post('statuses/update', params, function (err, data, response) {
      if (err) return reject(err);
      winston.debug('Updated status');
      resolve(data);
    });
  })
  .then(({id_str}) => `https://twitter.com/BenoitMandelbot/status/${id_str}`);
};

function uploadOptimisedMedia(filePath) {
  let stats = fs.statSync(filePath)
  if (stats.size > 2.5 * 1024 * 1024) {
    execFileSync(gifsicle, [
      '-b', filePath,
      '--colors', '64',
      '--dither',
    ]);
  }
  return exports.uploadMedia(filePath);
}

exports.tweetWithImages = function(stillImages, status) {
  return Promise.all(_.map(stillImages, uploadOptimisedMedia))
  .then((media_ids) => {
    return exports.updateStatus({ status, media_ids })
  });
}
