const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Store connections and room information
let userConnections = [];

// Socket.IO logic
io.on("connection", (socket) => {
  console.log("New client connected: " + socket.id);

  // Handle user joining a meeting
  socket.on("userconnect", (data) => {
    console.log("User connected:", data.displayName, "to meeting", data.meetingid);

    // Filter other users in the same meeting
    let other_users = userConnections.filter((p) => p.meeting_id == data.meetingid);

    // Add the new user to the connections list
    userConnections.push({
      connectionId: socket.id,
      user_id: data.displayName,
      meeting_id: data.meetingid,
    });

    // Inform other users about the new participant
    other_users.forEach((v) => {
      socket.to(v.connectionId).emit("inform_other_about_me", {
        other_user_id: data.displayName,
        connId: socket.id,
        userNumber: userConnections.length,
      });
    });

    // Inform the new participant about other users
    socket.emit("inform_me_about_other_user", other_users);
  });

  // Handle SDP messages
  socket.on("SDPProcess", (data) => {
    io.to(data.to_connId).emit("SDPProcess", {
      message: data.message,
      from_connid: socket.id,
    });
  });

  // Handle chat messages
  socket.on("sendMessage", (msg) => {
    console.log(msg);
    var mUser = userConnections.find((p) => p.connectionId == socket.id);
    if (mUser) {
      let meetingid = mUser.meeting_id;
      let from = mUser.user_id;
      let list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        socket.to(v.connectionId).emit("showChatMessage", {
          from: from,
          message: msg,
        });
      });
    }
  });

  // Handle file transfer
  socket.on("fileTransferToOther", (msg) => {
    console.log(msg);
    var mUser = userConnections.find((p) => p.connectionId == socket.id);
    if (mUser) {
      let meetingid = mUser.meeting_id;
      let from = mUser.user_id;
      let list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        socket.to(v.connectionId).emit("showFileMessage", {
          username: msg.username,
          meetingid: msg.meetingid,
          filePath: msg.filePath,
          fileName: msg.fileName,
        });
      });
    }
  });

  // Handle user disconnecting
  socket.on("disconnect", () => {
    console.log("Client disconnected: " + socket.id);
    let disUser = userConnections.find((p) => p.connectionId == socket.id);
    if (disUser) {
      let meetingid = disUser.meeting_id;
      userConnections = userConnections.filter((p) => p.connectionId != socket.id);
      let list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        let userNumberAfterUserLeave = userConnections.length;
        socket.to(v.connectionId).emit("inform_other_about_disconnect_user", {
          connId: socket.id,
          uNumber: userNumberAfterUserLeave,
        });
      });
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
