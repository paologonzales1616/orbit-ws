require("dotenv").config();
const redis = require("socket.io-redis");

const io = require("socket.io")(process.env.PORT);
const { verifyToken, decodeToken } = require("./services/jwt");

const History = require("./model/history");
const Notification = require("./model/notification");

// connect to our database
require("./database/index")();

io.adapter(redis({ host: "localhost", port: 6379 }));

io.on("connect", client => {
  console.log(`${client.id} is connected!`);

  // Check if token is valid
  // Check if client is already login
  // If admin return list logged users
  client.on("auth", userCreds => {
    if (!userCreds.token) {
      io.to(`${client.id}`).emit("auth", {
        status: "fail",
        message: "No token receive!"
      });
      io.sockets.connected[client.id].disconnect();
      return;
    }

    if (!verifyToken(userCreds.token)) {
      io.to(`${client.id}`).emit("auth", {
        status: "fail",
        message: "Invalid token!"
      });
      io.sockets.connected[client.id].disconnect();
      return;
    }

    io.to(`${client.id}`).emit("auth", {
      status: "success",
      message: "Authentication successful!"
    });

    const payload = decodeToken(userCreds.token);
    payload.session_id = client.id;
    client.credentials = payload;

    if (payload.admin) {
      io.to(`${client.id}`).emit("users", {
        status: "success",
        data: {
          users: checkUsersStatus(payload.id)
        }
      });
    } else {
      const credential = client.credentials;
      const session_id = getAdminSessionId(credential.admin_id);
      if (session_id) {
        io.to(`${session_id}`).emit("user", {
          id: credential.id,
          action: "connect"
        });
      }
    }
  });

  client.on("status", payload => {
    const { admin_id, id } = client.credentials;
    if (client.credentials) {
      const session_id = getAdminSessionId(admin_id);

      const newHistory = new History();
      newHistory.lat = payload.lat;
      newHistory.lng = payload.lng;
      newHistory.location = payload.name;
      newHistory.speed = payload.speed;
      newHistory.user_id = id;
      newHistory.admin_id = admin_id;
      newHistory.save();

      io.to(`${session_id}`).emit("status", {
        id: id,
        data: {
          lat: parseFloat(payload.lat),
          lng: parseFloat(payload.lng),
          speed: parseInt(payload.speed),
          location: payload.name
        },
        metadata: {
          speed_unit: "m/s"
        }
      });
    }
  });

  client.on("notify", payload => {
    const { admin_id, id } = client.credentials;
    if (client.credentials) {
      const session_id = getAdminSessionId(admin_id);

      const newNotification = new Notification();
      newNotification.message = payload.message;
      newNotification.user_id = id;
      newNotification.admin_id = admin_id;
      newNotification.save();

      io.to(`${session_id}`).emit("status", {
        id: id,
        data: {
          message: payload.message
        }
      });
    }
  });

  client.on("disconnect", () => {
    console.log(`${client.id} got disconnect!`);
    if (client.credentials) {
      const { admin_id, id } = client.credentials;
      const session_id = getAdminSessionId(admin_id);
      io.to(`${session_id}`).emit("user", {
        id: id,
        action: "disconnect"
      });
    }
  });
});

const checkUsersStatus = admin_id => {
  let loggedUsers = [];
  const clients = getAuthenticatedClients();
  clients.forEach(element => {
    if (typeof element !== "undefined") {
      if (element.admin_id) {
        if (element.admin_id == admin_id) {
          loggedUsers.push(element);
        }
      }
    }
  });
  return loggedUsers;
};

const getAuthenticatedClients = () => {
  const clients = io.sockets.clients().connected;
  const sockets = Object.values(clients);
  return sockets.map(s => {
    if (typeof s.credentials !== "undefined") {
      return s.credentials;
    }
  });
};

const getAdminSessionId = admin_id => {
  let session_id = "";
  const clients = getAuthenticatedClients();
  clients.forEach(element => {
    if (typeof element !== "undefined") {
      if (element.admin) {
        if (element.id == admin_id) {
          session_id = element.session_id;
        }
      }
    }
  });
  return session_id;
};
