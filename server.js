const express = require("express");
const path = require("path");
const app = express();
const fs = require("fs");
const fileUpload = require("express-fileupload");

const server = app.listen(3000, function () {
  console.log("Listening on port 3000");
});

const io = require("socket.io")(server, {
  allowEIO3: true,
});

// Хранилище подключенных пользователей по комнатам
const rooms = {};

// Статические файлы
app.use(express.static(path.join(__dirname, "public")));

// Парсинг JSON и URL-encoded данных
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware для загрузки файлов
app.use(fileUpload());

// Роут для загрузки файлов
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

// Обработка соединения через socket.io
io.on("connection", (socket) => {
  console.log("socket id is", socket.id);

  // Обработка подключения нового пользователя
  socket.on("userconnect", (data) => {
    console.log("userconnect", data.displayName, data.meetingid);

    // Добавляем пользователя в комнату
    if (!rooms[data.meetingid]) {
      rooms[data.meetingid] = [];
    }
    rooms[data.meetingid].push({
      connectionId: socket.id,
      user_id: data.displayName,
      meeting_id: data.meetingid,
    });

    // Отправляем информацию о других пользователях в комнате текущему пользователю
    let other_users = rooms[data.meetingid].filter(
      (p) => p.connectionId !== socket.id
    );
    socket.emit("inform_me_about_other_user", other_users);

    // Уведомляем остальных пользователей в комнате о новом пользователе
    other_users.forEach((v) => {
      socket.to(v.connectionId).emit("inform_other_about_me", {
        other_user_id: data.displayName,
        connId: socket.id,
        userNumber: rooms[data.meetingid].length,
      });
    });
  });

  // Обработка отправки сообщения
  socket.on("sendMessage", (msg) => {
    console.log(msg);
    var mUser = rooms[msg.meetingid].find((p) => p.connectionId == socket.id);
    if (mUser) {
      let from = mUser.user_id;
      rooms[msg.meetingid].forEach((v) => {
        socket.to(v.connectionId).emit("showChatMessage", {
          from: from,
          message: msg.message,
        });
      });
    }
  });

  // Обработка передачи файла
  socket.on("fileTransferToOther", (msg) => {
    console.log(msg);
    var mUser = rooms[msg.meetingid].find((p) => p.connectionId == socket.id);
    if (mUser) {
      let from = mUser.user_id;
      rooms[msg.meetingid].forEach((v) => {
        socket.to(v.connectionId).emit("showFileMessage", {
          username: msg.username,
          meetingid: msg.meetingid,
          filePath: msg.filePath,
          fileName: msg.fileName,
        });
      });
    }
  });

  // Обработка отключения пользователя
  socket.on("disconnect", function () {
    console.log("User got disconnected");
    for (let room in rooms) {
      let disUser = rooms[room].find((p) => p.connectionId == socket.id);
      if (disUser) {
        rooms[room] = rooms[room].filter(
          (p) => p.connectionId != socket.id
        );
        rooms[room].forEach((v) => {
          let userNumberAfterUserLeave = rooms[room].length;
          socket.to(v.connectionId).emit("inform_other_about_disconnect_user", {
            connId: socket.id,
            uNumber: userNumberAfterUserLeave,
          });
        });
      }
    }
  });
});
