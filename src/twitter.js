const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const _ = require('underscore');
const Twit = require('twit');
const winston = require('winston');

const {OUTPUT_DIR} = require('./env');
const latestReplyFile = path.join(OUTPUT_DIR, 'latestReply.txt');
const cutoffTime = fs.existsSync(latestReplyFile) ? parseInt(
  fs.readFileSync(latestReplyFile, 'utf8'), 10
) : -1;

const client = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

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
};

exports.tweetWithImages = function (stillImages, status) {
  return Promise.all(_.map(stillImages, uploadOptimisedMedia))
  .then((media_ids) => {
    return exports.updateStatus({ status, media_ids })
  });
};

exports.stripTweet = function (t) {
  return {
    id: t.id_str,
    date: Date.parse(t.created_at),
    url: t.entities.media[0].media_url,
  };
}

exports.getPopularColourSchemes = function() {
  // Find the most recent tweet by @colorschemez with the most replies which
  // is after a previous tweet time.
  return new Promise((resolve, reject) => {
    client.get(
      'search/tweets',
      {q: 'to:colorschemez', count: 30, result_type: 'recent'},
      (err, data) => {
        if (err) return reject(err);
        // Object where the key is the status ID, and the value is the number
        // of replies to this status
        const tweetsToReplies = _.chain(data.statuses)
        .groupBy('in_reply_to_status_id_str')
        .mapObject(v => v.length)
        .value();

        client.get('statuses/lookup', {id: _.keys(tweetsToReplies)}, (err, data) => {
          if (err) return reject(err);
          data.sort((t1, t2) => {
            let lengthDifference = tweetsToReplies[t2.id_str] - tweetsToReplies[t1.id_str];
            if (lengthDifference) return lengthDifference;
            return Date.parse(t2.created_at) - Date.parse(t1.created_at);
          });
          const tweets = _.filter(_.map(data, exports.stripTweet), t => {
            return t.date > cutoffTime;
          });
          winston.debug(tweets);
          resolve(tweets);
        });
      }
    );
  })
  .then((tweets) => new Promise((resolve, reject) => {
    // Also add all the recent tweets by @colorschemez.
    client.get('statuses/user_timeline', {
      count: 30,
      screen_name: 'colorschemez',
      exclude_replies: true,
    }, (err, data) => {
      if (err) return reject(err);
      let newTweets = _.chain(data)
      .sortBy((t) => -t.retweet_count)
      .map(exports.stripTweet)
      .filter(t => t.date > cutoffTime)
      .filter(t => !_.some(tweets, s => s.id === t.id))
      .value();

      resolve(tweets.concat(newTweets));
    });
  }));
}

exports.replyWithImage = function (stillImage, status, in_reply_to_status_id) {
  return Promise.all(_.map([stillImage], uploadOptimisedMedia))
  .then((media_ids) => {
    return exports.updateStatus({status, media_ids, in_reply_to_status_id});
  });
};
