'use strict';

const path = require('path');
const express = require('express');
const config = require('./config');
var handlebars = require('express-handlebars').create({defaultLayout:'main'});
var session = require('express-session');
var request = require('request');


// Set Oauth2.0 info in environment
const URL = process.env.URL;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = URL + "/oath";

const app = express();

app.disable('etag');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('trust proxy', true);
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

// set up session 
app.use(session({
  secret: "thisisapassword1",
  resave: true,
  saveUninitialized: true,
}));;

app.get('/', (req, res) => {
  res.render('./home');
});

app.get('/login', (req, res) => {
  // Generate random secret and store in session
  var state = "SuperSecret" + Math.floor((Math.random() * 9999) + 1)
  req.session.state = state;

  var google = "https://accounts.google.com/o/oauth2/v2/auth";
  var scope = "email";
  var response_type = "code";
  
  // Redirect to Google's login page
  var requestURL = google + "?response_type=" + response_type + "&client_id=" + CLIENT_ID + "&redirect_uri=" + REDIRECT_URI + "&scope=" + scope + "&state=" + req.session.state;
  res.redirect(requestURL);
});

app.get('/oath', (req, res) => {
  // Verify this is the previously generated state
  var isCorrectState = req.query.state == req.session.state; 

  var google = "https://www.googleapis.com/oauth2/v4/token";
  var code = req.query.code; 
  var grant_type = "authorization_code";

  var body = {
    "code": code, 
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET, 
    "redirect_uri": REDIRECT_URI, 
    "grant_type": grant_type
  }
  
  // Get access token using credentials
  request.post({
      url: google,
      body: body,
      json: true
    }, function(error, response, body){
          getUserInfo(body.access_token);
  });

  // Get Google+ info 
  function getUserInfo(access_token) {
    var requestURL = "https://www.googleapis.com/plus/v1/people/me";
    request.get({
      headers: {
        'Authorization' : 'Bearer ' + access_token,
        "Accept": "application/json"
      },
      url:     requestURL,
      json: true
    }, function(error, response, body){
      var context = {}
      context.state = req.session.state;
      context.first_name = body.name.givenName;
      context.last_name = body.name.familyName;
      context.isCorrectState = isCorrectState;
      if (body.url) {
        context.url = body.url;
      }

      res.render("./oath", context);
    });
  }
});

// Basic 404 handler
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Basic error handler
app.use((err, req, res, next) => {
  /* jshint unused:false */
  console.log("GENERAL ERROR HANDLER")
  console.error(err);
  // If our routes specified a specific response, then send that. Otherwise,
  // send a generic message so as not to leak anything.
  if (err.code) {
    res.status(err.code).send(err.response || err.message);
  }
  else {
    res.status(500).send(err.response || "Something broke");
  }
});

if (module === require.main) {
  // Start the server
  const server = app.listen(config.get('PORT'), () => {
    const port = server.address().port;
    console.log(`App listening on port ${port}`);
  });
}

module.exports = app;