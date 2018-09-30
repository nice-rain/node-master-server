'use strict'

//Function that will loop through the entire response and build a row for each index.
//The row will contain the servername and IP address (we can always add more information later).
function buildTableRows(res)
{
    //string that will hold all built rows
    let rows;
    


    //For loop for each server in our response
    for(let i = 0; i < res.length; i++)
    {
        //Add each row to our stored rows
        rows += `<tr><td>${res[i].serverName}</td> 
        <td>IP ${res[i].serverIP}:${res[i].serverPort}</td></tr>`;
    }

    updateTable(rows);
}


//Function updates our table with headings and generated rows
function updateTable(rows)
{
    let headings = `<tr><th>Server Name</th><th>Address</th></tr>`

    $('.js-server-list').html(headings + rows);
}

//Issues a GET request to return all servers. On success, will call buildTableRows to add rows to html.
function RefreshTable()
{
    //Get request to our server
    $.getJSON("http://localhost:8082/server", (res) =>{
        
        //Check to make sure we have at least 1 server if we are going to update table
        if(res.length > 0)
        {
            buildTableRows(res);
        }
        else
        {
            console.log("Warning: Our response had no listed servers.");
        }
    })
    .catch(err=>{
        console.log(err);
    });
}


//Automatically Refresh our List
$(RefreshTable());