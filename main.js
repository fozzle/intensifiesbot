var express = require('express'),
  app = express(),
  config = require('./config.json'),
  childProcess = require('child_process'),
  fs = require('fs'),
  twitterAPI = require('node-twitter-api'),
  twitter = new twitterAPI({
    consumerKey: config.twitterConsumerKey,
    consumerSecret: config.twitterConsumerSecret,
    callback: ''
  }),
  nlp = require('nlp_compromise'),
  request = require('request'),
  Bing = require('node-bing-api')({accKey: config.bingKey});

app.get('/', function(req, res) {

  getRandomWord(function(word) {
    word = word.word.toLowerCase();
    var conjugated = nlp.verb(word).conjugate()
    console.log(conjugated);
    if (!conjugated.gerund) {
      return;
    } else {
      word = conjugated.gerund;
    }
    getRandomImageForNoun(word, function(err, result) {
      res.send("<h1>" + word + "</h1><img src='" + result + "' />");
      var lastPathComponent = result.split("/"),
        fileParts = lastPathComponent[lastPathComponent.length - 1].split(".");

      download(result, fileParts.join('.'), function() {
        convertToGif(fileParts, word);
      });
    });
  });
});

function convertToGif(fileParts, word) {
  var extension = fileParts[1],
  filename = fileParts[0];

  // Create gif
  childProcess.execSync('convert scrap/' + fileParts.join('.') + ' -page +2+0 -background white -flatten scrap/' + filename + '-1.'+ extension);
  childProcess.execSync('convert scrap/' + fileParts.join('.') + ' -page +0+2 -background white -flatten scrap/' + filename + '-2.' + extension);
  childProcess.execSync('convert scrap/' + fileParts.join('.') + ' -page -2+0 -background white -flatten scrap/' + filename + '-3.' + extension);
  childProcess.execSync('convert scrap/' + fileParts.join('.') + ' -page +0-2 -background white -flatten scrap/' + filename + '-4.' + extension);
  childProcess.execSync('convert -delay 2 `seq -f scrap/'+filename+'-%01g.'+extension+' 1 1 4` -coalesce final/'+ filename + '.gif');
  childProcess.execSync('convert final/' + filename + '.gif -stroke "#000" -strokewidth 1 -font '+ config.font +' -pointsize 24 -gravity south -fill white -annotate +0+10 "[' + word + ' intensifies]" final/' + filename + '.gif');

  // Cleanup
  childProcess.exec('rm scrap/' + filename + '*');

  twitter.statuses("update_with_media", {
        status: "[" + word + " intensifies]",
        media: [
        "final/"+filename+".gif",
        ]
    },
    config.twitterAccessToken,
    config.twitterAccessSecret,
    function(error, data, response) {
        if (error) {
            // something went wrong
            console.log(error);
        } else {
            // data contains the data sent by twitter
            console.log(data);
        }
  });
}

function getRandomWord(callback) {
  request({
    url: "http://api.wordnik.com:80/v4/words.json/randomWord",
    qs: {
      "includePartOfSpeech": "verb",
      "minCorpusCount": 10000,
      "api_key": config.wordnikKey
    },
    json: true
  }, function(err, res, body) {
      console.log(body);
      callback(body);
    });
}

function download(uri, filename, callback){
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream('scrap/' + filename)).on('close', callback);
  });
};

function getRandomImageForNoun(noun, callback) {
  Bing.images(noun, function(err, res, body) {
    var randomIndex = Math.floor(Math.random() * body.d.results.length),
      resultUrl = body.d.results[randomIndex].MediaUrl;

    callback(err, resultUrl);
  }, {
    imagefilters: {
      size: "medium",
      style: "photo"
    }
  });
}

var server = app.listen(3000, function() {
  var host = server.address().address;
  var port = server.address().port;

});