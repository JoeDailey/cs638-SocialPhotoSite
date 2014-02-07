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
        db.run('CREATE TABLE "users" ("user_id" INTEGER PRIMARY KEY  NOT NULL  UNIQUE, "name" VARCHAR(70) NOT NULL UNIQUE, "email" VARCHAR(140) NOT NULL UNIQUE, "password" VARCHAR(61) NOT NULL, "points" INTEGER NOT NULL  DEFAULT 0, "created_at" DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP);');
        console.log("Creating users table.");
    });
}
/////////END CREATE DATABASE
//Database End/////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//Set Up Start///////////////////////////////////////////////////////////////////////////
//rendering/////////////////////////////////////////////////////////////////////////////// 
var express = require('express');
var cs638 = express();
cs638.use(express.favicon());

cs638.set('view engine', 'ejs');
//path/////////////////////////////////////////////////////////////////////////////////////
cs638.use("/static", express.static(__dirname + '/static')); //static
//cookies//////////////////////////////////////////////////////////////////////////////////
cs638.use(express.cookieParser('PhOtOs!'));
//body parsing/////////////////////////////////////////////////////////////////////////////
cs638.use(express.json());
cs638.use(express.urlencoded());

cs638.set('view options', {
    layout: false
});
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

var port = Number(process.env.PORT || 8000);
cs638.listen(port, function() {
  console.log("Listening on " + port);
});
//setup ends//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////
//Gets and Posts start///////////////////////////////////////////////////////////////////////////////////
cs638.get('/', function(req, res){
    getUser(req, res, function(user){
        res.render('home', {'user':user});
    })
});
cs638.get('/auth', function(req, res){
    res.render('landing');
});


//Routing End///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
//Login/Logout Start//////////////////////////////////////////////////////////////////////
//---------------------------------------------/////-login
cs638.post("/login", function(req, res){
    var name = req.body.username;
    var password = req.body.password;
    db.serialize(function(){
        db.get('SELECT * FROM users WHERE name="'+name+'";', function(err, row){
            if(err==null){
                if(row!=undefined){//exists
                    comparePassword(password, row.password, function(nul, match){
                        if(match == true){
                            res.cookie('name', ""+row.name, { maxAge: 3600000, signed: true });
                            res.redirect("/");
                        }else{
                            res.send(304, {message:'user exists but wrong password'});
                        }
                    });
                }else{//does not exist
                    res.send(404, {message:'user does not exist'});
                }
            }else{//err
                res.send(500, {message:"dbase erro"});
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
                                res.cookie('user',""+name, { signed: true });
                                console.log("redirecting home")
                                res.redirect("/");
                            }else{
                                console.log(err);
                                res.send(500, {message:err});
                            }
                        });
                    });
                }else{
                    res.send(304, {message:"that user already exists"});
                }
            }else{
                console.log(checkErr);
                res.send(500, {message: 'there was an error connecting to the Database'})
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

//API End///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
//404 Error start/////////////////////////////////////////////////////////////////////////
cs638.get("*", function(req, res){
    res.render('error', {
        "errorNumber":404,
        "errorMessage":"sorry, lulz"
    });
});
//404 Error end/////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
//Misc Start//////////////////////////////////////////////////////////////////////////////
//base cookie check and navigation building
var getUser = function(req, res, callback){
    console.log(req.signedCookies);
    if (req.signedCookies.user == undefined) {
        res.redirect('/auth');
    } else {
        db.serialize(function(){
            db.get('SELECT * FROM users where name="'+req.signedCookies.user+'";', function(err, user){
                if(user && err==null)
                    callback(user);
                else
                    res.redirect('/');
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
