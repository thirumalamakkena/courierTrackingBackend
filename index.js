const express = require("express");
const app = express();

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
app.use(express.json());

const path = require("path");

const dbPath = path.join(__dirname, "courier_tracking.db");

let db = null;
const port = process.env.PORT || 4000;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
   app.listen(port, async () => {
      console.log(`server is running on port ${port}`);
    }); 
    
  } catch (e) {
    console.log(e.message);
  }
};

initializeDBAndServer();

app.get("/", (req, res) => {
  res.status(200).send("Courier Tracking Application");
});

app.get("/about", (req, res) => {
  res.status(200).send("About Page");
});

app.get("/getCourier/:courierID", async (request, response) => {
  const { courierID } = request.params;
  const query = `
   SELECT 
        *
    FROM 
       couriers
    WHERE 
        courier_id = ${courierID};
       `;
  const obj = await db.get(query);
  if (obj === undefined) {
    response.status(400);
    response.send({});
  }
  else {
    response.send(obj);
  }
});

