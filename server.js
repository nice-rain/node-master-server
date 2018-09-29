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
// CORS
//=======================================================

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

//=======================================================
// GET Endpoint - Return Server List
//=======================================================

//This endpoint is used to retrieve the entire server list from the database.
//It will return an array of servers currently active within game.
app.get('/server', (req,res) => {

    //Right now this returns all servers. We need to query ones with a heartbeat < 5 minutes
    Servers.find()
    .then(servers => {
        //Map all found servers to an array after we serialize them
        res.json(servers.map(server=> server.serialize()));
    })
    .catch(err =>{
      console.log(`\n\nError: ${err}`);

      //Can't connect to the database or other failure
      res.status(500).json({error:"Internal Server Error"});
    })
});

//=======================================================
// Heartbeat Endpoint - Allow Server to Remain Listed
//=======================================================

//GET /:id/:port will allow us to refresh the server heartbeat. We will return a success status once we refresh.
//On a failed status, the game will know that it needs to send a POST to register with the master server.

//=======================================================
// POST Endpoint - Register a new server
//=======================================================

//This requires a body containing a server name and port. We will retrieve the IP from the request and set the date ourselves.//#endregion

app.post('/server', (req, res)=>
{
 //Required body keys
  const requiredFields = ['serverName', 'serverPort'];

  //Loop through our keys and make sure they are in our body
  for(let i = 0; i < requiredFields.length; i++)
  {
    if(!(requiredFields[i] in req.body))
    {
      const message = `Missing \`${requiredFields[i]}\` in request body`;
      console.error(`\n\nError: ${message}`);
      return res.status(400).send(message);
    }
  }

  //If we've made it here, we have all our required fields - create a new database entry
  const newServer = {
    serverName: req.body.serverName,
    serverIP: req.ip,
    serverPort: req.body.serverPort,
    updated: Date.now() //Server sets the time
  };

  Servers.create(newServer)
  .then(newServer => {
    //We will return status 201, the server ID, and original params sent
    res.status(201).json(newServer.serialize());
  })
  .catch(err =>
  {
    console.log(`\n\nError: ${err}`);
    res.status(500).json({error: 'internal server error'});
  });
});





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
      mongoose.connect(databaseUrl, {useNewUrlParser:true}, err => {
        if (err) {
          return reject(err);
        }
        server = app.listen(port, () => {
          console.log(`Master server is listening on port ${port}`);
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
        console.log('Closing master server');
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