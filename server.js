// Express and AJAX
var express = require("express");
var session = require("express-session");
var app = express();
var bodyParser = require("body-parser");
// Database and MySQL
var mysql = require("mysql");
var fs = require("fs");
var multer = require("multer");
var storage = multer.diskStorage({
  destination: function (request, file, callback) {
    callback(null, '/example/uploads');
  },
  filename: function (request, file, callback) {
    //console.log(file);
    callback(null, file.originalname)
  }
});

var upload = multer({dest: "./uploads/profile/"});


// TODO Replace login details with proper bookit database. Thx adam :)
var sqlLogin = {
  host: "localhost",
  user: "bookit",
  password: "1234",
  database: "bookit"
};

//Initalization
app.use(express.static(__dirname + "/pages"));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({extended:true, limit: '50mb'}));
app.use(session({
  secret: 'nurf this',
  resave: false,
  saveUninitialized: true,
  //cookie: {secure:true}
}));

//Code Body

/*-------------------- REST Functions --------------------------- */

//Checks if there's a currently logged in user and sends back what user is logged in.
app.get("/user", function(req,res){
    //console.log(req.session.login_id);
  if(req.session.login_id == null){
    res.status(401).send("No user logged in.");
  }
  else{
    console.log("Requested user logged : " + req.session.login_fName);
    res.status(200).send(req.session.login_fName);
  }
});
/*
  If there's an active and valid login session then the website will return additonal infomation to the session
*/
app.get("/user/detail", function(req,res){
  var details
  if (req.session.login_id == null){
    details = {"user": "N/A", "email": "N/A", "phone": "NA"};
    console.log("No User Logged!!!");
    res.status(401).send(details);
  }
  else{
    details = {"user": req.session.login_fName,"email": req.session.login_email, "phone": req.session.login_phone}
    console.log("User details found. Sending profile to client.");
    res.status(200).send(JSON.stringify(details));
  }
});
/*
  Destroys the current session of the active user and returns an error message if there's no user
*/
app.get("/user/logout", function(req,res){
  if(req.session.login_id == null){
    res.status(400).send("No user logged in.");
  }
  else{
    req.session.destroy();
    res.status(200).send("User sucessfully logged out!");
  }
});

//Check login details for when user logs in first time
app.post("/user/login", function(req, res){
  var connection = mysql.createConnection(sqlLogin);
  console.log(req.body.name);
  connection.query("SELECT * FROM `user` WHERE `email` = ?",[req.body.name], function(err,results,fields){
    if( results == undefined || results.length == 0 ){
      return res.status(404).send("ERROR: NO USER FOUND!");
    }
    for(i = 0;i < results.length;i++){
      if(results[i].password == req.body.pass){
        console.log("User " + req.body.fName + " sucessfully logged in!");
        req.session.login_id = results[i].U_ID;
        req.session.login_fName = results[i].fName; //TODO loginid should be changed to loginName but as to not break other code
        req.session.login_phone = results[i].phoneNum;
        req.session.login_email = results[i].email;
        console.log("User " + req.session.login_fName + " just logged in.");
        connection.end();
        res.send("Welcome " + req.session.login_fName);
      }
    }
  });
});

//Register a new user
app.post("/user/register", function(req, res){
  addUserToDatabase(req.body);
  res.send(req.body.email + " was registered sucessfully.");
  console.log(req.body.email + " was registered sucessfully.");
  res.end("done")
});

// Gets a users image via email
app.get("/user/img", function(req, res){
  console.log(req.session.login_email);
  var connection = mysql.createConnection(sqlLogin); //Establish connection to database
  connection.query("SELECT * FROM `user` WHERE `email` = ?",[req.session.login_email], function(err, results, fields){
    if(imageURL == null || results[0] == undefined){
      res.status(404).send("Profile picture not found");
      connection.end();
    }
    else{
      var imageURL = results.profile_ref;
      connection.end();
      console.log(__dirname + "/content/profile/" + imageURL);
      res.sendFile(__dirname + "/content/profile/" + imageURL);
    }
  })
});
/*
  POST: Inserts an image into /uploads/profile/
  USAGE: Post image and query at /user/img/?q=<EMAIL GOES HERE>
  To be used in sync with GET "/user/img" to allow client to request images via their email
*/
app.post("/user/img", upload.single("profile"), function(req, res, next){
  if(req.file == undefined){
    res.status(404).send("No file attached!")
    return next();
  }
  if(req.query.q == undefined){
    res.status(404).send("No email query in request!");
    return next();
  }
  // Change multer filename to uploaded name
  fs.rename(__dirname + "/uploads/profile/" + req.file.filename, __dirname + "/uploads/profile/" + req.file.originalname);
  // Update user's reference to profile img
  var connection = mysql.createConnection(sqlLogin);
  connection.query("UPDATE user SET profile_ref = ? WHERE email = ?", [req.file.originalname, req.query.q])
  res.status(200).send(req.file.originalname + " posted and linked to " + req.query.q);
});
/*
  GET: Gets event details from the event table
  USAGE:
    eventSearch: search for a event by its name. Returns Max 5 results
    eventID: Gets a single event via it's ID
    NOTE for the time being, the only way to add a new event is via the database
*/
app.get("/event", function(req, res, next){
  var connection = mysql.createConnection(sqlLogin);
  if(req.query.eventSearch != undefined){
    connection.query("SELECT * FROM `event` WHERE `event_Name` LIKE ? LIMIT 5", ["%" + req.query.eventSearch + "%"], function(err, results, fields){
      res.send(results);
      return next();
    });
  }
  else if(req.query.eventID != undefined){
    connection.query("SELECT * FROM `event` WHERE E_ID = ?", [req.query.eventID], function(err,results, fields){
      res.send(results);
      return next();
    });
  }
  else{
    res.status(400).send("No query!!");
    return next();
  }
});

// Create a new user entry in the database using a JSON file consisting of thier submited details.
function addUserToDatabase(user){
  var connection = mysql.createConnection(sqlLogin);
  connection.connect();
  connection.query("INSERT INTO user SET ?", {
    fName: user.fName,
    lName: user.lName,
    dob: user.date,
    address: user.address,
    email: user.email,
    phoneNum: user.phone,
    password: user.pass}, function(err,result){
    if (err) throw err;
  });
  connection.end();
}


/* ------------------------Test Functions------------------------------------ */

//Test database
// function databaseUserTestData(){
//   var connection = mysql.createConnection(sqlLogin);
//   connection.connect();
//   var data = {fName: 'Bob', lName: 'Ross', dob: '2017/02/23', address: 'an address', email: 'something@something.com', phoneNum: '15468754', password: '12345'};
//   var query = connection.query('INSERT INTO user SET ?', data, function(err, result){
//   // Success!
//   });
//   console.log(query.sql);
// }
//
// function databaseEventTestData(){
//   var connection = mysql.createConnection(sqlLogin);
//   connection.connect();
//   var data = {event_Name: "ut massa quis augue luctus", eDate:"2016-03-27", location:"Ngluweng Dua", capacity:3966, descrp:"Integer ac leo. Pellentesque ultrices mattis odio. Donec vitae nisi."};
//   var query = connection.query('INSERT INTO event SET ?', data, function(err, result){
//   // Success!
//   });
//   console.log(query.sql);
// }
//NOTE Breaks on running. Prehaps the first paramater of "connection.query" needs to be a string?
//function search(){
 //var connection = mysql.createConnection(sqlLogin);
 //var searchQuery = document.getElementById('search-bar').textContent;
 //connection.query("SELECT * FROM event WHERE event_Name LIKE %searchQuery%",
   //function(err, result){
     //if (err) throw err;
   //});
//};

app.listen(8080);
