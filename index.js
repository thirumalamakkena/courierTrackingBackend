const express = require("express");
const app = express();
const cors = require('cors');

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


app.use(cors());

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
    response.send({ errorMsg: "Username or password is invalid" });
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbUser.password_hash
    );
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send({ errorMsg: "username and password didn't match" });
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
  const {
    courierID,
    courierName,
    fromAddress,
    toAddress,
    isDelivered = "false",
  } = request.body;

  const updateCourierQuery = `
    INSERT INTO couriers 
    VALUES
    (
        ${courierID},
        '${courierName}',
        '${fromAddress}',
       '${toAddress}',
        CURRENT_TIMESTAMP,
        '${isDelivered}'
    );
  `;

  await db.run(updateCourierQuery);
  response.send({ message: "Courier Successfully Added" });
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
  response.send({ message: "Shipment Added Successfully" });
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
  response.send({ message: "Shipment Updated Successfully" });
});

app.delete("/deleteShipment/:shipmentID", async (request, response) => {
  const { shipmentID } = request.params;
  const deleteCourierQuery = `
    DELETE FROM tracking_history
    WHERE
    tracking_id = ${shipmentID};
  `;
  await db.run(deleteCourierQuery);
  response.send({ message: "Shipment Deleted Successfully" });
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
    response.send({message: "Tracking Data Not Found"});
  } else {
    response.send(trackingData.map((data) => formatData(data)));
  }
});


const formatCourierData = (data) => {
  return {
    courierID: data.courier_id,
    courierName: data.courier_name,
    fromAddress: data.from_address,
    toAddress: data.to_address,
    timestamp: data.timestamp,
    isDelivered: data.is_delivered,
  };
}

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
  const courierInfo = await db.get(query);
  if (courierInfo === undefined) {
    response.status(400);
    response.send({message:"Courier Not Found"});
  }
  else {
    response.send(formatCourierData(courierInfo));
  }
});


app.get("/getCouriers", async (request, response) => {
  const { courierID } = request.params;
  const query = `
   SELECT 
        *
    FROM 
       couriers;
    
       `;
  const courierInfo = await db.all(query);
    response.send(courierInfo);
});


