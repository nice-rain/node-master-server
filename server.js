'use strict'

//Imports
const express = require("express");
const app = express();

//Import our port
const {PORT} = require("./config");

app.use(express.static("public"));


//Include morgan for server logging
const morgan = require('morgan');

//log our http layer
app.use(morgan('common'));

//Use our json parser (this is required to parse req.body)
app.use(express.json());



//Allows us to store our server so that we may close it later
let server;

//Start our server
function runServer() {

  return new Promise((resolve, reject) => {
    server = app.listen(PORT, () => {
        console.log(`Your app is listening on port ${PORT}`);
        resolve();
      })
        .on('error', err => {
          reject(err);
        });
    });
}

// this function closes the server, and returns a promise.
function closeServer() {
    return new Promise((resolve, reject) => {
      console.log('Closing server');
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
}

// if server.js is called directly (aka, with `node server.js`), this block
// runs. but we also export the runServer command so other code (for instance, test code) can start the server as needed.
if (require.main === module) {
  runServer().catch(err => console.error(err));
}

//Export our modules for testing
module.exports = { app, runServer, closeServer };