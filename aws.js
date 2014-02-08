var express = require('express');
var cs638 = express();
var fs = require("fs");
cs638.set('view engine', 'ejs');
cs638.use(express.bodyParser());

var knox      = require('knox');
var knoxCopy  = require('knox-copy');

var knox_params = {
    key: process.env.AWS_ACCESS_KEY_ID.toString(),
    secret: process.env.AWS_SECRET_ACCESS_KEY.toString(),
    bucket: process.env.AWS_S3_BUCKET.toString()
  }

var port = Number(process.env.PORT || 8000);
cs638.listen(port, function() {
  console.log("Listening on " + port);
});


cs638.get('/', function(req, res){
 res.render('aws');
});


cs638.post('/', function(req, res) {

  var client = knox.createClient(knox_params);
  console.log(req.files.file.name)
  var file = req.files.file;
  var filename = (file.name).replace(/ /g, '-');

  client.putFile(file.path, 'scratch/' + filename, {'Content-Type': file.type, 'x-amz-acl': 'public-read'}, 
    function(err, result) {
      if (err) {
        return; 
      } else {
        if (200 == result.statusCode) { 
          console.log('Uploaded to Amazon S3!');

          fs.unlink(file.path, function (err) {
            if (err) throw err;
            console.log('successfully deleted /'+file.path); 
          });

        } else { 
          console.log('Failed to upload file to Amazon S3'); 
        }

        res.redirect('/'); 
      }
  });

});