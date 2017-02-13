const fs = require('fs');
const path = require('path');

const _ = require('underscore');
const Twit = require('twit');
const winston = require('winston');

const {OUTPUT_DIR} = require('./env');
const {twitterAuth} = require('./auth');

var client = new Twit(twitterAuth);

const latestReplyFile = path.join(OUTPUT_DIR, 'latestReply.txt');
const cutoffTime = fs.existsSync(latestReplyFile) ? -1 : parseInt(
  fs.readFileSync(latestReplyFile, 'utf8'), 10
);

function getPopularColourScheme() {
  return new Promise((resolve, reject) => {
    client.get(
      'search/tweets',
      {q: 'to:colorschemez', count: 15, result_type: 'recent'},
      (err, data) => {
        if (err) return reject(err);
        // Object where the key is the # of replies, and the value is a list of
        // status IDs
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
          const tweets = _.filter(_.map(data, t => ({
            id: t.id_str,
            date: Date.parse(t.created_at),
            url: t.entities.media[0].media_url,
          })), t => {
            return t.date > cutoffTime;
          });
          winston.debug(tweets);
          resolve(tweets[0]);
        });
      }
    );
  })
}

getPopularColourScheme()
.then(tweet => {
  if (!tweet) {
    winston.info('No eligible tweets');
    return;
  }
  fs.writeFileSync(latestReplyFile, tweet.date);

  /* 
  {
    id: '829766226901479424',
    date: 1486972659000,
    url: 'http://pbs.twimg.com/media/C4Pr_GFUoAAX0Lf.jpg'
  }
  */

})
.catch(err => {
  winston.error(err);
});

// 'http://pbs.twimg.com/media/C4ktzwOUYAANrKi.jpg'
