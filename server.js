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

//Mongoose fix deprecation warning
mongoose.set('useFindAndModify', false);

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

//Global variable for number of ms in a minute
const MS_PER_MINUTE = 60000;

//Global for number of ms in a day 
const MS_PER_DAY = 86400000;

//=======================================================
// Automatically Clear Database
//=======================================================

//This function runs on an interval. It will remove all dead servers older than 24 hours.
function clearDeadServers()
{
  //Determine the time limit to query for (heartbeat within 5 minutes)
  const currentTime = Date.now();
  const timeLimit = new Date(currentTime - MS_PER_DAY);

  //Only returns servers with a heartbeat in the last 5 minutes
  Servers.deleteMany({updated: {$lte: timeLimit}})
  .then(()=>{
    //notify that our deletion was successful
    console.log(`Deleted all servers that haven't had a heartbeat in 24 hours.`);
    
  })
  .catch(err =>{
    console.log(`Error Deleting Cache`);
  });
}

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

    //Determine the time limit to query for (heartbeat within 5 minutes)
    
    const currentTime = Date.now();
    const timeLimit = new Date(currentTime - 5 * MS_PER_MINUTE);

    //Only returns servers with a heartbeat in the last 5 minutes
    Servers.find({updated: {$gte: timeLimit}})
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
app.get('/server/:id/:port', (req,res) =>
{
  Servers.findById(req.params.id)
  .then(server =>{
    
    //Validate our port matches
    let port = parseInt(req.params.port);

    //Store our IP
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if(server.serverPort !== port)
    {
      const message = `Request Port: ${req.params.port} does not match server port.`;
      console.log(message);
      res.status(400).send(message);
    }
    //Validate that our server IP matches
    else if(server.serverIP !== ip)
    {
      const message = `Request IP: ${ip} does not match stored IP.`;
      console.log(message);
      res.status(400).send(message);
    }

    //Both port and IP match
    else{
      //Find our server in the database
      Servers.findOneAndUpdate({_id: req.params.id}, {$set: {updated: Date.now()}})
      .then(updatedServer =>{
        console.log(updatedServer.serverName);
        res.status(200).send('Heartbeat Successful');
      })
      .catch(err =>{
        console.log(`\n\nError: ${err}`);
        res.status(500).json({error: "internal server error"});
      })
    }
  })

  //Error finding ID
  .catch(err =>{
    res.status(500).json({error: "Server may not exist. POST to register server."});
  });
});

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

  //store our IP
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;


  //Before we create a new server, check to see if we already have one with the same IP/Port
  Servers.countDocuments({serverIP: ip, serverPort: req.body.serverPort}, (err, count) =>
  { 
    //Check to see if we found any indices
    if(count>0){
      
      console.log("server exists");

      //Basically the same as a PUT here, update all fields
      //Note: We could throw an error here to notify the server to try a PUT request.
      //I felt this was easier for the sake of use and server calls
      const updated = {};
      //We can update this to allow fields such as playerCount
      const updateableFields = ['serverName'];
      updateableFields.forEach(field => {
        if (field in req.body) {
          updated[field] = req.body[field];
        }
      });

      //Update our heartbeat
      updated.updated = Date.now();
      
      //Update our server's fields
      Servers.findOneAndUpdate({serverIP: ip, serverPort: req.body.serverPort}, { $set: updated }, { new: true })
        .then((updatedServer) => {
          console.log("POST request updated existing server.");
          res.status(200).json(updatedServer.serialize(true));
        })
        .catch(err => {
          res.status(500).json({ message: 'Internal Sever Error when updating' });
        });
    }

    //IP address doesn't exist, go ahead and create a new entry in the database.
    else{
      //Declare a new server
      const newServer = {
        serverName: req.body.serverName,
        serverIP: ip,
        serverPort: req.body.serverPort,
        updated: Date.now() //Server sets the time
      };

      Servers.create(newServer)
      .then(newServer => {
        //We will return status 201, the server ID, and original params sent
        res.status(201).json(newServer.serialize(true));
      })
      .catch(err =>
      {
        //Error if we have trouble calling Create
        console.log(`\n\nError: ${err}`);
        res.status(500).json({error: 'internal server error'});
      });
    }
  })
  //Error handling for countDocuments
  .catch(err =>
    {
      console.log(`\n\nError: ${err}`);
        res.status(500).json({error: 'internal server error'});
    });  
});


//=======================================================
// PUT Endpoint - Modify server fields
//=======================================================

//PUT /:id/:port endpoint - Allows us to change server name, or number of players
app.put('/server/:id/:port', (req, res) =>
{
  //store our IP
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;


  //validate our IP address and Port 
  Servers.findById(req.params.id)
  .then(server =>{
    
    //Validate our port matches
    let port = parseInt(req.params.port);
    if(server.serverPort !== port)
    {
      const message = `Request Port: ${req.params.port} does not match server port.`;
      console.log(message);
      res.status(400).send(message);
    }

    //Validate that our server IP matches
    else if(server.serverIP !== ip)
    {
      const message = `Request IP: ${ip} does not match stored IP.`;
      console.log(message);
      res.status(400).send(message);
    }

    //Validate our ID in our body matches the ID in the parameter
    else if(!(req.params.id && req.body.id && req.params.id === req.body.id)) 
    {
      const message = `Request Path ID: ${ip} and request body ID must match.`;
      console.log(message);
      res.status(400).send(message);
    }

    //Both port and IP match
    else{
      
      //We need to check to see which fields we are passing to update

      const updated = {};
      //We can update this to allow fields such as playerCount
      const updateableFields = ['serverName'];
      updateableFields.forEach(field => {
        if (field in req.body) {
          updated[field] = req.body[field];
        }
      });

      //Update our heartbeat
      updated.updated = Date.now();
      
      //Update our server's fields
      Servers.findByIdAndUpdate(req.params.id, { $set: updated }, { new: true })
        .then(updatedServer => {
          console.log("PUT request successful, server fields updated.")
          res.status(204).end()
        })
        .catch(err => res.status(500).json({ message: 'Internal Sever Error' }));
    }
  })

  //Error finding ID
  .catch(err =>{
    res.status(500).json({error: "Server may not exist. POST to register server."});
  });

});

//=======================================================
// DELETE Endpoint - Called when server is closed
//=======================================================

// Called when we shutdown server normally. Will automatically remove it from the master server database.
// We will validate server IP and port as well for security.
app.delete('/server/:id/:port', (req, res) =>
{
  //store our IP
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

   //validate our IP address and Port 
   Servers.findById(req.params.id)
   .then(server =>{
     
     //Validate our port matches
     let port = parseInt(req.params.port);
     if(server.serverPort !== port)
     {
       const message = `Request Port: ${req.params.port} does not match server port.`;
       console.log(message);
       res.status(400).send(message);
     }
 
     //Validate that our server IP matches
     else if(server.serverIP !== ip)
     {
       const message = `Request IP: ${ip} does not match stored IP.`;
       console.log(message);
       res.status(400).send(message);
     }
 
     //Both port and IP match
     else
     {
        //Remove ID from database
        Servers.deleteOne({_id: req.params.id})
        .then(()=>{
          //notify that our deletion was successful
          console.log(`Deleted server with id \`${req.params.id}\``);
          res.status(204).end();
        })
        .catch(err =>{
          res.status(500).json({error: "Internal Server Error."});
        });
     }
   })
   //Error finding ID
   .catch(err =>{
     res.status(500).json({error: "Server may not exist. POST to register server."});
   });

});





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

          //Set our interval for clearing servers without a heartbeat every 24 hours (runs once per day).
          setInterval(clearDeadServers, MS_PER_DAY);

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
module.exports = { app, runServer, closeServer, clearDeadServers };