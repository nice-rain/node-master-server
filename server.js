'use strict'

//=======================================================
// Imported Dependencies
//=======================================================

//Imports
const express = require("express");
const app = express();

//Mongoose
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

//Import the database url and port we'll use for this application
const {DATABASE_URL, PORT} = require("./config");

//Import our schema
const {Servers} = require("./models");


//Serve our static front-end
app.use(express.static("public"));


//Include morgan for server logging
const morgan = require('morgan');

//log our http layer
app.use(morgan('common'));

//Use our json parser (this is required to parse req.body)
app.use(express.json());


//=======================================================
// Endpoints
//=======================================================

//GET endpoint - This endpoint will return entire list of all servers that have given a heartbeat within the past 5 minutes.

app.get('/server', (req,res)=>{

});

//GET /:id/:port endpoint - This endpoint will be called to refresh heartbeat on server. Will error if server is not registered (need to send a post request if we receive an error.)

//POST endpoint - Register a server with the master server. It will error if the server is already registered.

//PUT /:id/:port endpoint - Allows us to change server name, port, or number of players

//DELETE /:id/:port endpoint - Called when we shutdown server normally. Will automatically remove it from the master server database.





//=======================================================
// Open and Close Server
//=======================================================

//Allows us to store our server so that we may close it later
let server;

//Start our server
function runServer(databaseUrl, port = PORT) {
    return new Promise((resolve, reject) => {
      mongoose.connect(databaseUrl, err => {
        if (err) {
          return reject(err);
        }
        server = app.listen(port, () => {
          console.log(`Your app is listening on port ${port}`);
          resolve();
        })
          .on('error', err => {
            mongoose.disconnect();
            reject(err);
          });
      });
    });
  }

// this function closes the server, and returns a promise.
function closeServer() {
    return mongoose.disconnect().then(() => {
      return new Promise((resolve, reject) => {
        console.log('Closing server');
        server.close(err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      });
    });
  }

// if server.js is called directly (aka, with `node server.js`), this block
// runs. but we also export the runServer command so other code (for instance, test code) can start the server as needed.
if (require.main === module) {
    runServer(DATABASE_URL).catch(err => console.error(err));
}


//Export our modules for testing
module.exports = { app, runServer, closeServer };