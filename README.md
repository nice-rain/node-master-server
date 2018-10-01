# node-master-server
A master server written in node.js for use in online games.

## Summary
This application serves as a RESTful master server that may be implemented online games. A master server stores a list of all game servers that are currently active. Once a server registers with the master server, the information is stored. The server must issue a heartbeat within 5 minutes or the server will drop off the list. When players want to view all servers, the master server sends a JSON response containing the information needed to connect to the available game servers.

## Installation and Setup
1. Clone the this resposity to your server.
2. Run npm install to install all dependencies.
3. Add your database address to the config.js file.
4. Optional: If you are using express to serve static assets, make sure to change the server address in getJSON (line 36) in client.js to your web server's address.

## Endpoints

### GET /server
This endpoint will return an array of server objects that contain the following keys:
* serverName
* serverIP
* serverPort
* updated

### GET /server/:id/:port
This endpoint is our 'heartbeat' endpoint. Requests sent to this endpoint are validated by ID, IP Address, and Port. If all 3 match the server sending the request, the 'updated' key will be updated to the current time. This endpoint must be called once every 5 minutes in order for the server to remain listed by the master server.

### POST /server
This endpoint is used to register a server with the master server. Requests send to this must contain the following keys:
* serverName - Name displayed by the server
* serverPort - Port that you intend players to connect to

Response from this endpoint will contain the server ID. This ID *must* be stored in order to close down or update the serverName.

### PUT /server/:id/:port
This endpoint validates our server's IP, ID, and Port. The body must contain the following key:
* serverName

If the server validates, it will update the serverName with a new serverName.

### DELETE /server/:id/:port
This endpoint is used to remove a server from the database. ID, Port, and IP address are validated for this endpoint as well. Use this endpoint to manually remove a server (such as when you close the game server down). 

## Automatically Clearing Dead Servers
Your game servers *should* call the DELETE endpoint when the server is closed down. A server that is not closed down will remain in the database (it just won't be listed after 5 minutes). Dead servers (servers with no heartbeat for 24 hours) will be cleared once per day on the server. 

## Handling GET Response in your game
The JSON response will return an IP and Port that may be used to connect to a game server. Because the information may not be valid, it is recommended to ping/query every server on the returned list. An example game flow may look like this:

1. Player clicks refresh servers button and receives a GET response.
2. Loop through every index of response and ping every game server on the list.
3. Any game server that doesn't have a valid ping is removed (the server is down).
4. After pinging each game server, you should query each game server for information (number of players, game mode, etc.)
5. Player selects a server from the list and clicks the connect button.
6. IP address and port are then used to connect the player to the game server.

## Screenshots

Static Asset Front-End (only used to display list of current servers without logging into game)
![Static Asset Front-End](https://NiceRa.in/rain/sharex/screenshots/chrome_2018-09-30_21-27-02.png)


## Built With
* HTML
* CSS
* JavaScript
* JQuery
* Node.js

## Dependencies
* express
* morgan
* mongoose
* mocha (testing)
* chai (testing)
* chai-http (testing)
* faker (testing)
