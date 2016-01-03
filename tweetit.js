var config = require('./config.json'),
  childProcess = require('child_process'),
  fs = require('fs'),
  gm = require('gm'),
  twitterAPI = require('node-twitter-api'),
  twitter = new twitterAPI({
    consumerKey: config.twitterConsumerKey,
    consumerSecret: config.twitterConsumerSecret,
    callback: ''
  }),
  nlp = require('nlp_compromise'),
  request = require('request'),
  Bing = require('node-bing-api')({accKey: config.bingKey});

// The main promise chain
var wordPromise = getRandomWord()
  .then(gerundifyWord);

var imagePromise = wordPromise
  .then(getRandomImageForWord)
  .then(function(imageUrl) {
    var pathComponents = imageUrl.split("/"),
      lastPathComponent = pathComponents[pathComponents.length - 1];
    return download(imageUrl, lastPathComponent);
  });

var gifPromise = Promise.all([imagePromise, wordPromise])
    .then(function(results) {
      return convertToGif(results[0], results[1])
    });

var mediaPromise = gifPromise
    .then(uploadMedia)
    .catch(function (err) {
      console.log(err);
    });

Promise.all([mediaPromise, wordPromise])
  .then(function(results) {
    return updateStatus(results[0], results[1])
  })
  .catch(function(err) {
    console.log(err);
    process.exit();
  });

function gerundifyWord(word) {
  return new Promise(function(resolve, reject) {
    word = word.word.toLowerCase();
    var conjugated = nlp.verb(word).conjugate()
    if (!conjugated.gerund) {
      reject("No gerund");
    } else {
      resolve(conjugated.gerund);
    }
  });
}

function convertToGif(fileParts, word) {
  console.log(fileParts);
  return new Promise(function (resolve, reject) {
    var extension = fileParts[1],
    filename = fileParts[0];

    // Create gif
    var counter = 0,
      originalImage = fs.readFileSync('scrap/' + fileParts.join('.')),
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
                    resolve(filename);
                  });
              }
            });
        }
      });

  //promise
  });

}

function uploadMedia(filename) {
  return new Promise(function (resolve, reject) {
    twitter.uploadMedia({
        media: "final/"+filename+".gif"
      },
      config.twitterAccessToken,
      config.twitterAccessSecret,
      function(error, data, resp) {
        if (error) {
          reject(error);
        } else {
          resolve(data.media_id_string);
        }
      });
  });
}

function updateStatus(media_id, word) {
  return new Promise(function(resolve, reject) {
    console.log("posting status");
    twitter.statuses("update",
      {
        status: "[" + word + " intensifies]",
        media_ids: [media_id]
      },
      config.twitterAccessToken,
      config.twitterAccessSecret,
      function(error, data, resp) {
        if (error) {
          console.log("error updating status");
          reject(error);
        } else {
          resolve();
        }
      })
  });
}

function getRandomWord() {
  return new Promise(function(resolve, reject) {
    request({
      url: "http://api.wordnik.com:80/v4/words.json/randomWord",
      qs: {
        "includePartOfSpeech": "verb",
        "minCorpusCount": 5000,
        "api_key": config.wordnikKey
      },
      json: true
    }, function(err, res, body) {
        if (err) {
          reject(err);
        } else {
          resolve(body);
        }
      });
  });
}

function download(uri, filename){
  return new Promise(function(resolve, reject) {
    request.head(uri, function(err, res, body){
      console.log('content-type:', res.headers['content-type']);
      console.log('content-length:', res.headers['content-length']);

      request(uri).pipe(fs.createWriteStream('scrap/' + filename)).on('close', function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(filename.split("."));
        }
      });
    });
  });
};

function getRandomImageForWord(word) {
  return new Promise(function(resolve, reject) {
    Bing.images(word, function(err, res, body) {
      var randomIndex = Math.floor(Math.random() * body.d.results.length),
      resultUrl = body.d.results[randomIndex].MediaUrl;

      if (err || !resultUrl) {
        reject(err);
      } else {
        resolve(resultUrl)
      }
    }, {
      imagefilters: {
        size: "medium",
        style: "photo"
      }
    });
  });
}
