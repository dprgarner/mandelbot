const fs = require('fs');

const Twit = require('twit');

const {twitterAuth} = require('./auth');

var client = new Twit(twitterAuth);

exports.uploadMedia = function(filePath) {
  return new Promise((resolve, reject) => {
    client.postMediaChunked({file_path: filePath}, (err, data, _response) => {
      if (err) return reject(err);
      console.log('Uploaded ' + filePath);
      resolve(data.media_id_string);
    });
  });
};

exports.updateStatus = function(params) {
  return new Promise((resolve, reject) => {
    client.post('statuses/update', params, function (err, data, response) {
      if (err) return reject(err);
      console.log('Updated status');
      resolve(data);
    });
  });
};
