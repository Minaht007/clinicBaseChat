const express = require("express");
const path = require("path");
const app = express();
const fs = require("fs");
const fileUpload = require("express-fileupload");

let server = app.listen(3000, function () {
  console.log("Listening on port 3000");
});

const io = require("socket.io")(server, {
  allowEIO3: true,
});
app.use(express.static(path.join(__dirname, "public")));
let userConnections = [];
io.on("connection", (socket) => {
  console.log("socket id is", socket.id);
  socket.on("userconnect", (data) => {
    console.log("userconnect", data.displayName, data.meetingid);

    let other_users = userConnections.filter(
      (p) => p.meeting_id == data.meetingid
    );

    userConnections.push({
      connectionId: socket.id,
      user_id: data.displayName,
      meeting_id: data.meetingid,
    });

    let userCount = userConnections.length;
    

    other_users.forEach((v) => {
      socket.to(v.connectionId).emit("inform_other_about_me", {
        other_user_id: data.displayName,
        connId: socket.id,
        userNumber: userCount,
      });
    });
    socket.emit("inform_me_about_other_user", other_users);
  });
  socket.on("SDPProcess", (data) => {
    io.to(data.to_connId).emit("SDPProcess", {
      message: data.message,
      from_connid: socket.id,
    });
  });

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

  socket.on("fileTransferToOther", function(msg){
    console.log(msg)
    let user0
  })

  socket.on("disconnect", function () {
    console.log("User got disconnected");
    let disUser = userConnections.find((p) => p.connectionId == socket.id);
    if (disUser) {
      let meetingid = disUser.meeting_id;
      userConnections = userConnections.filter(
        (p) => p.connectionId != socket.id
      );
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
// "Share data"

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.post("/attachimg", function (req, res) {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }
  let data = req.body;
  let imageFile = req.files.zipfile;
  console.log(imageFile);

  let dir = path.join(__dirname, "public", "attachment", data.meeting_id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  let filePath = path.join(dir, imageFile.name);
  imageFile.mv(filePath, function (error) {
    if (error) {
      console.log("Couldn't upload the file, error: ", error);
      return res.status(500).send(error);
    } else {
      console.log("Image file successfully uploaded");
      res.send("File uploaded!");
    }
  });
});


