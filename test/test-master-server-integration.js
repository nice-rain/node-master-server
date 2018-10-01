'use strict'

//=======================================================
// Imports
//=======================================================

//include chai for individual tests
const chai = require('chai');
const chaiHttp = require('chai-http');

//Mongoose allows us to open our db
const mongoose = require('mongoose');

//Faker seeds us with random data
const faker = require('faker');

//Allows us to use 'expect' syntax
const expect = chai.expect;

//Import our model
const {Servers} = require('../models');

//Import our server (so we can open/close it)
const { runServer, app, closeServer, clearDeadServers } = require('../server');

//Test database url import
const {TEST_DATABASE_URL} = require('../config');

//Middleware
chai.use(chaiHttp);

//Declare our local server IP for testing
const LOCAL_SERVER_IP = "::ffff:127.0.0.1";

//=======================================================
// Setup/Tear Down of database
//=======================================================


// This function performs two major things for us (it's called beforeEach)
// 1. It calls generateServerData 10 times and adds it to an array.
// 2. Once we've generated 10 servers, it inserts 10 into our database.
function seedServerData() {
    console.info('seeding server data');
    const seedData = [];
  
    for (let i=1; i<=10; i++) {
      seedData.push(generateServerData());
    }

    //Seed it with a server that's older than 5 minutes
    const currentTime = Date.now();
    const newTime = new Date(currentTime - 80000);
    let deadServer = generateServerData();
    deadServer.updated = newTime;
    seedData.push(deadServer);


    //Seed it with an entry that has our localhost IP
    let localServer = generateServerData();
    localServer.serverIP = LOCAL_SERVER_IP;
    seedData.push(localServer);


    // this will return a promise
    return Servers.insertMany(seedData);
  }

  //Fills our server with 10 random servers
  function generateServerData(){
    return {

        serverName: faker.internet.userName(),
        serverIP: faker.internet.ipv6(),
        serverPort: faker.random.number(),
        updated: faker.date.future()
    }
  }

  //Called afterEach
  function tearDownDB()
  {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
  }



  //Sets up hook functions and hosts other describe functions
describe('Master Server API Tests', function() {

    //=======================================================
    // Hooks for before, after, afterEach, and beforeEach
    //=======================================================
 
     //Runs before anything else, runs our server
     before(function() {
       return runServer(TEST_DATABASE_URL);
     });
   
     //Called before each test we do
     beforeEach(function() {
       return seedServerData();
     });
   
     //Called after each test completes
     afterEach(function() {
       return tearDownDB();
     });
   
     //Called when we have completed our tests
     after(function() {
       return closeServer();
     });
 
     //=======================================================
     // GET Endpoint tests
     //=======================================================
 
     describe('\nGET Endpoint', function(){
 
 
         //First test, should return all existing servers we seeded with
         it('should return all living servers', function() {
             
             //Declare this so that we can store our response to it for later access.
             let res;
             return chai.request(app)
               .get('/server')    //This needs to match our get endpoint
               .then(function(_res) {
                 //store our response for access in the next .then call
                 res = _res;
 
                 //Check that our status is 200 (the status returned in server.js)
                 expect(res).to.have.status(200);
 
                 //We should have at least one server returned on GET
                 expect(res.body).to.have.lengthOf.at.least(1);
 
                 //Return the ACTUAL count from our database (of all living servers)
                 const currentTime = Date.now();
                 const timeLimit = new Date(currentTime - 5 * 60000);
                 return Servers.countDocuments({updated: {$gte: timeLimit}});
               })
               //Once our count is fetched and returned...
               .then(function(count) {
 
                 //Check our count to see if it matches the response length
                 expect(res.body).to.have.lengthOf(count);
               });
           });
 
         //check to make sure our fields are correct
         it('should return the correct fields', function()
         {
             let resFirstServer;
             return chai.request(app)
             .get('/server')
             .then(function(res){ //we use res here instead of _res because we won't pass the full response
 
                 //Expect we have the right status, type (json array), length
                 expect(res).to.have.status(200);
                 expect(res.body).to.have.lengthOf.at.least(1);
                 expect(res).to.be.json;
                 expect(res.body).to.be.a('array');
 
                 //forEach to make sure that every server is an object
                 res.body.forEach(function(server){
                     expect(server).to.be.a('object');
                 });
 
                 //Set our first server so that we may use it in the next .then statement
                 resFirstServer = res.body[0];
 
                //Fetch our first server and return it
                 return Servers.findOne({serverIP: resFirstServer.serverIP, serverPort: resFirstServer.serverPort});
             })
             .then(function(firstServer){ 
                 //Make sure all entries are equal
                 expect(resFirstServer.serverIP).to.equal(firstServer.serverIP);
                 expect(resFirstServer.serverPort).to.equal(firstServer.serverPort);
                 expect(resFirstServer.serverName).to.equal(firstServer.serverName);

                 //TODO compare updated time
             });

         });
     }); 

     //=======================================================
     // Heartbeat Test
     //=======================================================

     describe('\n Heartbest Test', function(){
         it('should add update the updated field and respond with heartbeat successful', function(){


        //Locate our local server (we seeded it above)
           return Servers
           .findOne({serverIP: LOCAL_SERVER_IP})
           .then(function(server) {   
                // Make a request and send updated data (using the ID returned in the previous block)
                return chai.request(app)
                .get(`/server/${server.id}/${server.serverPort}`)
            })
           .then(function(res) {
           
             //make sure our status matches what our put endpoint returns
             expect(res).to.have.status(200);
           });
        });
    });

 
     //=======================================================
     // POST Endpoint Tests
     //=======================================================
 
     describe('\nPOST Endpoint Tests', function()
     {
         //Success means that we added a new server to our database
         it('should add a new server', function() {
 
             //Generate a new server object to send
             const newServer = generateServerData();

             //This IP needs to be the IP of the test server
             newServer.serverIP = LOCAL_SERVER_IP;
       
             return chai.request(app)
             //Send our post request
               .post('/server')
               .send(newServer)
               //Handle the async response
               .then(function(res) {
 
                 //Check to make sure our status matches the response in server.js
                 expect(res).to.have.status(201);
 
                 //Make sure it's a json and our body is an object
                 expect(res).to.be.json;
                 expect(res.body).to.be.a('object');
 
                 //Make sure our body has the following keys
                 expect(res.body).to.include.keys(
                   'id', 'serverName', 'serverIP', 'serverPort', 'updated');
                 
                 //Make sure we have an ID
                 expect(res.body.id).to.not.be.null;
 
                 expect(res.body.serverName).to.equal(newServer.serverName);
                 expect(res.body.serverIP).to.equal(newServer.serverIP);
                 expect(res.body.serverPort).to.equal(newServer.serverPort);
                 //expect(res.body.updated).to.equal(newServer.updated);
       
                 //Return the server from our database
                 return  Servers.findById(res.body.id);
               })
               .then(function(server) {
                 //Check to make sure that our generated server and found server are the same
                 expect(newServer.serverName).to.equal(server.serverName);
                 expect(newServer.serverPort).to.equal(server.serverPort);
                 expect(newServer.serverIP).to.equal(server.serverIP);
                 //expect(newServer.updated).to.equal(server.updated);
               });
           });
 
     });
 
     //=======================================================
     // PUT Endpoint Test
     //=======================================================
 
     describe('PUT endpoint test', function() {
 
         it('should update fields sent across', function() {
 
             //Declare an object that we'll send to update
           const updateData = {
             serverName: 'Brand New Server'
           };
     
           //Locate our local server (we seeded it above)
           return Servers
             .findOne({serverIP: LOCAL_SERVER_IP})
             .then(function(server) {
                updateData.id = server.id;
                updateData.serverPort = server.serverPort;
     
           // Make a request and send updated data (using the ID returned in the previous block)
           return chai.request(app)
             .put(`/server/${server.id}/${server.serverPort}`)
             .send(updateData);
             })
             .then(function(res) {
             
               //make sure our status matches what our put endpoint returns
               expect(res).to.have.status(204);
     
               //Find our server by ID again
               return Servers.findById(updateData.id);
             })
             .then(function(server) {
                 //Check our server from the database to what we sent
               expect(server.serverName).to.equal(updateData.serverName);
             });
         });
       });
 
     //=======================================================
     // DELETE Endpoint Test
     //=======================================================
 
     //Get a server, make a delete request, check to make sure it doesn't exist
     describe('DELETE endpoint', function() {
 
         it('delete a server by id', function() {
     
           let server;
     
           return Servers
           //Locate our local server (seeded above)
             .findOne({serverIP: LOCAL_SERVER_IP})
             .then(function(resServer) {
                 //Store our server
                 server = resServer;
               return chai.request(app).delete(`/server/${server.id}/${server.serverPort}`);
             })
             .then(function(res) {
               //validate that our status matches our DELETE endpoint
               expect(res).to.have.status(204);
 
               //Attempt to find this server by the ID again
               return Servers.findById(server.id);
             })
             .then(function(resServer) {
                 //This should be null if we just deleted it
               expect(resServer).to.be.null;
             });
         });
       });
 
 });