var express = require('express'),
  app = express(),
  config = require('./config.json'),
  childProcess = require('child_process'),
  fs = require('fs'),
  gm = require('gm'),
  nlp = require('nlp_compromise'),
  request = require('request'),
  Bing = require('node-bing-api')({accKey: config.bingKey});

app.use(express.static(__dirname + '/final'));
app.set('views', './views')
app.set('view engine', 'jade');
app.get('/', function(req, res) {

  if (!req.query.word) {
    res.render('index');
    return;
  }

  var word = req.query.word.toLowerCase();
  getRandomImageForNoun(word, function(err, result) {
    var lastPathComponent = result.split("/"),
      fileParts = lastPathComponent[lastPathComponent.length - 1].split(".");

    download(result, fileParts.join('.'), function() {
      convertToGif(fileParts, word, res);
    });
  });
});

function convertToGif(fileParts, word, res) {
  var extension = fileParts[1],
  filename = fileParts[0];

  // Create gif
  var counter = 0,
    originalImage = require('fs').readFileSync('scrap/' + fileParts.join('.')),
    offsets = ['+2+0', '+0+2', '-2+0', '+0-2'];

  gm(originalImage, fileParts.join('.'))
    .options({imageMagick: true})
    .size(function(err, val) {
      for (var i = 0; i <= 3; i++) {
        gm(originalImage)
          .options({imageMagick: true})
          .page(val.width, val.height, offsets[i])
          .flatten()
          .write('scrap/' + filename + '-' + i +'.' + extension, function() {
            counter++;
            if (counter === 4) {
              childProcess.execSync('convert -delay 2 `seq -f scrap/'+filename+'-%01g.'+extension+' 0 1 3` -coalesce final/'+ filename + '.gif');
              childProcess.execSync('convert final/' + filename + '.gif -stroke "#000" -strokewidth 1 -font '+ config.font +' -pointsize 24 -gravity south -fill white -annotate +0+10 "[' + word + ' intensifies]" final/' + filename + '.gif');
              childProcess.exec('rm scrap/' + filename + '*');
              gm('final/'+filename+'.gif')
                .options({imageMagick: true})
                .crop(val.width - 4, val.height - 4, 2, 2)
                .write('final/' + filename + '.gif', function() {
                  res.render("result", {word: word, url: filename + ".gif"});
                });
            }
          })
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