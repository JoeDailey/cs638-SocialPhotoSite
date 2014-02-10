//Database Start//////////////////////////////////////////////////////////////////////////
var fs = require("fs");
////////CREATE DATABSE IF IT DOESN'T EXIST
var file = "db.sqlite3";
var exists = fs.existsSync(file);
if (!exists) {
    console.log("Creating DB file.");
    fs.openSync(file, "w");
} else {
    console.log("DB exists.");
}
var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database(file);
if (!exists) {
    db.serialize(function() {
        db.run('CREATE TABLE "users" ("user_id" INTEGER PRIMARY KEY NOT NULL UNIQUE, "name" VARCHAR(70) NOT NULL UNIQUE, "email" VARCHAR(140) NOT NULL UNIQUE,"posts" INTEGER NOT NULL DEFAULT 0,"following" INTEGER NOT NULL DEFAULT 0,"followers" INTEGER NOT NULL DEFAULT 0, "password" VARCHAR(61) NOT NULL,  "created_at" DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP);');
        db.run('CREATE TABLE "follows" ("follow_id" INTEGER PRIMARY KEY NOT NULL UNIQUE, "follow_target" VARCHAR(70) NOT NULL, "follower" VARCHAR(70) NOT NULL, "created_at" DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP);');
        db.run('CREATE TABLE "posts" ("post_id" INTEGER PRIMARY KEY NOT NULL UNIQUE, "name" VARCHAR(70) NOT NULL, "text" VARCHAR NOT NULL DEFAULT "", "image_url" NOT NULL, "created_at" DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP);')
    });
}
/////////END CREATE DATABASE
//Database End/////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//Set Up Start///////////////////////////////////////////////////////////////////////////
//rendering/////////////////////////////////////////////////////////////////////////////// 
var express = require('express');
var cs638 = express();
cs638.use(express.bodyParser());
cs638.use(express.favicon());

cs638.set('view engine', 'ejs');
//path/////////////////////////////////////////////////////////////////////////////////////
cs638.use("/static", express.static(__dirname + '/static')); //static
//cookies//////////////////////////////////////////////////////////////////////////////////
cs638.use(express.cookieParser('PhOtOs!'));
//body parsing/////////////////////////////////////////////////////////////////////////////
cs638.use(express.json());
cs638.use(express.urlencoded());
cs638.use(express.bodyParser());

cs638.set('view options', {
    layout: false
});


//knos is some file management package that makes some of this easier
var knox      = require('knox');
var knoxCopy  = require('knox-copy');

// these environment variables are needed for Amazon A3 Access and will need to be set on your dev box
var knox_params = {
//    key: process.env.AWS_ACCESS_KEY_ID.toString(),
//    secret: process.env.AWS_SECRET_ACCESS_KEY.toString(),
//    bucket: process.env.AWS_S3_BUCKET.toString()
    key: "AKIAJWOO3NJ2M2GBNGSA",
    secret: "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",
    bucket: "cs638-s3"
  }



//setup password encryption
var bcrypt = require('bcrypt-nodejs');
//encrypt password -> callback(err, hash)
var cryptPassword = function(password, callback) {
    bcrypt.genSalt(10, function(Salterr, salt) {
        if (Salterr)
            return callback(Salterr);
        else {
            bcrypt.hash(password, salt, null, function(err, hash) {
                return callback(err, hash);
            });
        }
    });
};
//decrypt password -> callback(bool matches)
var comparePassword = function(password, userPassword, callback) {
    bcrypt.compare(password, userPassword, function(err, isPasswordMatch) {
        if (err) return callback(err);
        else return callback(null, isPasswordMatch);
    });
};
//start server
//cs638.listen(8000);

var port = Number(8000);
cs638.listen(port, function() {
  console.log("Listening on " + port);
});
//setup ends//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////
//Gets and Posts start///////////////////////////////////////////////////////////////////////////////////
cs638.get('/', function(req, res){
    getUser(req, res, function(user, following){
        db.all('SELECT * FROM posts WHERE name IN (SELECT follow_target FROM follows WHERE follower="'+req.signedCookies.user+'") ORDER BY created_at DESC;', function(getErr, posts){
            if(!getErr)
                res.render('home', {'user':user, 
                                    'posts':posts,
                                    'following':JSON.stringify(following)
                });
            else
                res.redirect('/');
        });
    });
});
function error(num, message, err){
    console.log('ERROR: '+err);
    res.render('error', {
        "errorNumber":num,
        "errorMessage":message,
        "following":"[]"
    });
}


cs638.get('/auth', function(req, res){
    res.render('landing');
});

cs638.get('/user/:username', function(req, res){
    getUser(req, res, function(user, following){
        db.get('SELECT * FROM users WHERE users.name="'+req.params.username+'";', function(themErr, them){
            if(themErr){ error(500, "There was an error in the database", themErr); return;}
            db.all('SELECT * FROM posts WHERE name="'+req.params.username+'";', function(postErr, themposts){
                if(postErr){ error(500, "There was an error in the database", postErr); return;}
                console.log(following);
                res.render('home', {
                    'user':them,
                    'posts':themposts,
                    'following':following
                });
            });
        });
    });
});

cs638.get('/users', function(req, res){
    getUser(req, res, function(user, following){
        db.all('SELECT * FROM users;', function(themErr, them){
            if(themErr){ error(500, "There was an error in the database", themErr); return;}
            res.render('users', {
                'user':user,
                'them':them,
                'following':following
            });
        });
    });
});

//this post looks for a file and tries to upload it to Amazon s3
//the URL for the file will be https://s3.amazonaws.com/cs638-s3/scratch/<filename>
//todo:make filename unique
//todo:wire up the upload process to the posting process to save the url to the db

cs638.post('/post', function(req, res) {
    if(req.signedCookies.user==undefined){
        res.redirect('/auth');
    }else{
        var client = knox.createClient(knox_params);
        console.log(req.files.photo.name)
        var file = req.files.photo;
        var uuid = require('node-uuid');
        //var filename = (file.name).replace(/ /g, '-');
        var filename = uuid.v4()+'.jpg'

        client.putFile(file.path, 'scratch/' + filename, {'Content-Type': file.type, 'x-amz-acl': 'public-read'}, function(err, result) {
            if (err) {
                return; 
            } else {
                if (200 == result.statusCode) { 
                    console.log('Uploaded to Amazon S3!');

                    fs.unlink(file.path, function (err) {
                        if (err)
                        console.log('successfully deleted /'+file.path); 
                    });

                } else { 
                    console.log('Failed to upload file to Amazon S3'); 
                }
                db.run('INSERT INTO posts (text, image_url, name) VALUES ("'+req.body.text+'", "https://s3.amazonaws.com/cs638-s3/scratch/'+ filename+'", "'+req.signedCookies.user+'");', function(err){
                    if(!err){
                        db.run(' UPDATE users SET posts=posts+1 WHERE name="'+req.signedCookies.user+'";', function(err){

                        });
                        res.redirect('/');
                    }else{
                        console.log(err);
                        return; 
                    }
                })
            }
        });
    }
});

//Routing End///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
//Login/Logout Start//////////////////////////////////////////////////////////////////////
//---------------------------------------------/////-login
cs638.post("/login", function(req, res){
    var email = req.body.email;
    var password = req.body.password;
    db.serialize(function(){
        db.get('SELECT * FROM users WHERE email="'+email+'";', function(err, row){
            if(err==null){
                if(row!=undefined){//exists
                    comparePassword(password, row.password, function(nul, match){
                        if(match == true){
                                res.cookie('user',""+row.name, { signed: true });
                            res.redirect("/");
                        }else{
                            res.redirect('/');
                        }
                    });
                }else{//does not exist
                    res.redirect('/');
                }
            }else{//err
                res.redirect('/');
            }
        });
    });
});
//---------------------------------------------/////-register
//vars:
////username
////password
cs638.post("/register", function(req, res){
    var name = req.body.name;
    var password = req.body.password;
    var email = req.body.email;
    console.log(req.body);
    db.serialize(function(){
        db.get('SELECT * FROM users WHERE name="'+name+'";', function(checkErr, checkRow){
            if(checkErr==null){
                if(checkRow==undefined){
                    cryptPassword(password, function(cryptErr, hash){
                        db.run('INSERT INTO users (name, email, password) VALUES ("'+name+'","'+email+'","'+hash+'");', function(err){
                            if(err==null){
                                db.run('INSERT INTO follows (follow_target, follower) VALUES ("'+name+'","'+name+'");', function(err){
                                    res.cookie('user',""+name, { signed: true });
                                    res.redirect("/");
                                });
                            }else{
                                console.log(err);
                                res.redirect('/');
                            }
                        });
                    });
                }else{
                    res.redirect('/');
                }
            }else{
                console.log(checkErr);
                res.redirect('/');
            }
        });  
    });
});
//---------------------------------------------/////-logout
cs638.get('/logout', function(req, res){
  res.clearCookie('user');
  res.redirect('/');
});
//Login/Logout END//////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
//API Start///////////////////////////////////////////////////////////////////////////////
cs638.get('/api/follow/:username', function(req, res){
    if (req.signedCookies.user == undefined) {
        res.send(403, {message:"no user signed in"});
    }else{
        db.serialize(function(){
            db.get('SELECT * FROM follows WHERE follow_target="'+req.params.username+'" AND follower="'+req.signedCookies.user+'";', function(findErr, found){
                if(!findErr){
                    console.log(found);
                    if(found == undefined){
                        db.run('INSERT INTO follows (follow_target, follower) VALUES ("'+req.params.username+'","'+req.signedCookies.user+'");', function(err){
                            if(err){
                                res.send(500, {message:err});
                            }else{
                                db.run('UPDATE users SET followers=followers+1 WHERE name="'+req.params.username+'";', function(err){console.log("follow err: "+err);});
                                db.run('UPDATE users SET following=following+1 WHERE name="'+req.signedCookies.user+'";', function(err){console.log("follow err: "+err);});
                                res.send(200, {message:"user subscribed"});
                            }
                        });
                    }else{
                        db.run('DELETE FROM follows WHERE follow_target="'+req.params.username+'" AND follower="'+req.signedCookies.user+'";', function(err){
                            if(err){
                                res.send(500, {message:err});
                            }else{
                                res.send(200, {message:"user unsubscribed"});
                                db.run('UPDATE users SET followers=followers-1 WHERE name="'+req.params.username+'";', function(err){console.log("follow err: "+err);});
                                db.run('UPDATE users SET following=following-1 WHERE name="'+req.signedCookies.user+'";', function(err){console.log("follow err: "+err);});

                            }
                        });
                    }
                }else{
                    res.send(500, {message:findErr});
                }
            });
        });
    }
});
//API End///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
//404 Error start/////////////////////////////////////////////////////////////////////////
cs638.get("*", function(req, res){
    res.render('error', {
        "errorNumber":404,
        "errorMessage":"sorry, lulz", 
        "following":"[]"
    });
});
//404 Error end/////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
//Misc Start//////////////////////////////////////////////////////////////////////////////
//base cookie check and navigation building
var getUser = function(req, res, callback){
    if (req.signedCookies.user == undefined) {
        res.redirect('/auth');
    } else {
        db.serialize(function(){
            db.get('SELECT * FROM users where name="'+req.signedCookies.user+'";', function(err, user){
                if(user!=undefined && !err){
                     db.all('SELECT follow_target AS "" FROM follows WHERE follower="'+req.signedCookies.user+'";', function(followsErr, following){
                        if(!followsErr){
                            console.log(following);
                            following = JSON.stringify(following);
                            following = following.replace(/{/g, '');
                            following = following.replace(/""/g, '');
                            following = following.replace(/:/g, '');
                            following = following.replace(/}/g, '');
                            following = JSON.parse(following);
                            console.log(following);
                            callback(user, JSON.stringify(following));
                        }
                        else
                            callback(user, []);
                    });
                }else
                    res.redirect('/auth');
            });
        });
    }
}
//base 36 (a->z+0->9)
function url2id(url){
    return parseInt(url, 36);
}
function id2url(id){
    return id.toString(36);
}

//Misc End//////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
 