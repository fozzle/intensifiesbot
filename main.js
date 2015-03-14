var express = require('express'),
  app = express(),
  config = require('./config.json'),
  execSync = require('child_process').execSync,
  fs = require('fs'),
  request = require('request'),
  Bing = require('node-bing-api')({accKey: config.bingKey});

app.get('/', function(req, res) {

  getRandomWord(function(word) {
    word = word.word;
    getRandomImageForNoun(word, function(err, result) {
      res.send("<h1>" + word + "</h1><img src='" + result + "' />");
      var lastPathComponent = result.split("/"),
        fileParts = lastPathComponent[lastPathComponent.length - 1].split(".");
        extension = fileParts[1],
        filename = fileParts[0];

      console.log(fileParts);
      download(result, fileParts.join('.'), function() {
        console.log(execSync);
        execSync('convert scrap/' + fileParts.join('.') + ' -page +5+0 -background white -flatten scrap/' + filename + '-1.'+ extension);
        execSync('convert scrap/' + fileParts.join('.') + ' -page +0+5 -background white -flatten scrap/' + filename + '-2.' + extension);
        execSync('convert scrap/' + fileParts.join('.') + ' -page -5+0 -background white -flatten scrap/' + filename + '-3.' + extension);
        execSync('convert scrap/' + fileParts.join('.') + ' -page +0-5 -background white -flatten scrap/' + filename + '-4.' + extension);
        execSync('convert -delay 4 `seq -f scrap/'+filename+'-%01g.'+extension+' 1 1 4` -coalesce scrap/'+ filename + '.gif');
      });
    });
  });
//     exec('convert -v builds/pdf/book.html -o builds/pdf/book.pdf', function (error, stdout, stderr) {
//   // output is in stdout
// });
});

function getRandomWord(callback) {
  request({
    url: "http://api.wordnik.com:80/v4/words.json/randomWord",
    qs: {
      "includePartOfSpeech": "noun",
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
      size: "medium"
    }
  });
}

function intensifyImage(image, callback) {
  var count = 0;
  for (var i = 0; i < 4; i++) {
    exec('convert ' + image + ' -background black -virtual-pixel background -page +5+0 ' + image + 'temp' + i + '.png', function() {
      count++;

      if (count > 3) {
        callback();
      }
    })
  }

}

var server = app.listen(3000, function() {
  var host = server.address().address;
  var port = server.address().port;

});