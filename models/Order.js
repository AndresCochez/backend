const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  scoop: { flavor: String, color: String },           // bolletje
  cone: { style: String, color: String },             // hoorntje
  sprinkles: { level: String },                       // none|light|normal|heavy
  customer: {
    name: String,
    address: {
      street: String,
      city: String,
    },
  },
  price: Number,
  status: { type: String, default: 'pending' },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);
