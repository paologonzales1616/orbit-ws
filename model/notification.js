const mongoose = require("mongoose");

// Define schema for notification model
const notificationSchema = mongoose.Schema({
  timestamp: { type: Date, default: Date.now() },
  user_id: mongoose.Schema.Types.ObjectId,
  admin_id: mongoose.Schema.Types.ObjectId,
  message: String,
  seen: { type: Boolean, default: false }
});

module.exports = mongoose.model("notification", notificationSchema);
