'use strict'

//Import and setup mongoose
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

//Setup our Schema (an object definition of our database)
const serverSchema = mongoose.Schema({
    serverName: {type: String, required: true}, //Name of the server hosted
    serverIP: {type: String, required: true}, //This is not an efficient way to store IP addresses. We will need to clear cached severs frequently.
    serverPort: {type: Number, required: true}, //We need a port to connect to (especially with proxies)
    updated: {type: Date, default: Date.now} //Time to query for heartbeat
  });


// Function used to return all stored server variables
// Note: We use bShowID to prevent sending IDs to our entire GET request
serverSchema.methods.serialize = function(bShowID = false) {
    
    //Our default return
    const returnObject = {
        serverName: this.serverName,
        serverIP: this.serverIP,
        serverPort: this.serverPort,
        updated: this.updated
    };
    
    //If we are returning an ID, append it to the object
    if(bShowID)
    {
        returnObject.id = this._id;
    }
    
    //Return our built object
     return returnObject;
  };
  

//ServerList will be the name of our collection
 const Servers = mongoose.model('ServerList', serverSchema);

//Setup to export our Servers shema
module.exports = {Servers};