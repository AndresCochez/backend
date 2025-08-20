const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isLoggedIn: { type: Boolean, default: false }, // Houd bij of de gebruiker is ingelogd
});

module.exports = mongoose.model("User", userSchema);