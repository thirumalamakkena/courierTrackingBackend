const express = require("express");
const app = express();
const cors = require('cors');

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { format } = require("date-fns");

app.use(cors());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
app.use(express.json());


app.use(function (req, res, next) {

  // Allow all domains to connect
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});

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
  res.status(200).send({msg: "Courier Tracking Application"});
});

app.get("/about", (req, res) => {
  res.status(200).send(JSON.stringify({msg:"About Page"}));
});

app.get("/contact", (req, res) => {
  res.status(200).send(JSON.stringify([{msg:"contatct Page"},{msg:"About-Page"}]));
});

app.get("/address", (req, res) => {
  res.status(200).send([{errMsg:"contatct Page"},{errMsg:"About-Page"}]);
});

app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send(`Created new user with ${newUserId}`);
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

//Login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
        SELECT * FROM users WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send(JSON.stringify({ errorMsg: "Username or password is invalid" }));
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbUser.password_hash
    );
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send(JSON.stringify({ jwtToken }));
    } else {
      response.status(400);
      response.send(JSON.stringify({ errorMsg: "username and password didn't match" }));
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/addCourier", async (request, response) => {
  const date = format(new Date(), "MM/dd/yyyy");
  const {
    courierId,
    courierName,
    fromAddress,
    toAddress,
    isDelivered = "false",
  } = request.body;

  const updateCourierQuery = `
    INSERT INTO couriers 
    VALUES
    (
        ${courierId},
        '${courierName}',
        '${fromAddress}',
       '${toAddress}',
        CURRENT_TIMESTAMP,
        '${isDelivered}'
    );
  `;

  await db.run(updateCourierQuery);
  response.send(JSON.stringify({ message: "Courier Successfully Added" }));
});

app.post("/addShipment", async (request, response) => {
  const { shipmentID, status, location, courierID } = request.body;
  const updateCourierQuery = `
    INSERT INTO tracking_history 
    VALUES
    (
        ${shipmentID},
        '${status}',
        '${location}',
         CURRENT_TIMESTAMP,
        '${courierID}'
    );
  `;
  await db.run(updateCourierQuery);
  response.send(JSON.stringify({ message: "Shipment Added Successfully" }));
});

app.put("/updateShipment", async (request, response) => {
  const { status, location, shipmentID } = request.body;
  const updateCourierQuery = `
    UPDATE tracking_history
    SET 
    status = '${status}',
    location = '${location}'
    WHERE
    tracking_id = ${shipmentID};
  `;
  await db.run(updateCourierQuery);
  response.send(JSON.stringify({ message: "Shipment Updated Successfully" }));
});

app.delete("/deleteShipment/:shipmentID", async (request, response) => {
  const { shipmentID } = request.params;
  const deleteCourierQuery = `
    DELETE FROM tracking_history
    WHERE
    tracking_id = ${shipmentID};
  `;
  await db.run(deleteCourierQuery);
  response.send(JSON.stringify({ message: "Shipment Deleted Successfully" }));
});

const formatData = (data) => {
  return {
    shipmentID: data.tracking_id,
    status: data.status,
    location: data.location,
    courierId: data.courier_id,
    timestamp: data.timestamp,
  };
};

app.get("/getTrackingData/:courierID", async (request, response) => {
  const { courierID } = request.params;
  const query = `
    SELECT 
        *
    FROM 
       tracking_history
    WHERE 
        courier_id = ${courierID}
       `;
  const trackingData = await db.all(query);
  if (trackingData.length === 0) {
    response.status(400);
  } else {
    response.status(200).send(JSON.stringify(trackingData));
  }
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
  }
  else {
    response.status(200).send(JSON.stringify(obj));
  }
});




