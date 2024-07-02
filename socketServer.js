const { Server } = require("socket.io");

exports.handler = async (event, context) => {
  const io = new Server();

  io.on("connection", (socket) => {
    console.log("New client connected: " + socket.id);

    socket.on("sendMessage", (data) => {
      io.emit("message", data);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected: " + socket.id);
    });
  });

  return {
    statusCode: 200,
    body: "Socket server initialized",
  };
};
