require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Order = require('./models/Order');

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB connection (with graceful fallback) ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/benjerrys';
let dbConnected = false;
let memOrders = []; // in-memory fallback

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    dbConnected = true;
    console.log('[DB] Verbonden met MongoDB');
  } catch (err) {
    dbConnected = false;
    console.warn('[DB] Verbinding mislukt, gebruik in-memory opslag. Fout:', err.message);
  }
})();

// --- Helpers ---
function sanitizeOrderInput(body){
  const { scoop, cone, sprinkles, customer, price } = body || {};
  return { scoop, cone, sprinkles, customer, price };
}

function isValidOrder({ scoop, cone, sprinkles, customer, price }){
  if (!scoop || !cone || !sprinkles) return false;
  if (!customer || !customer.name || !customer.address) return false;
  if (price === undefined || price === null || isNaN(Number(price))) return false;
  return true;
}

// --- Routes ---

// Health
app.get('/api/health', (req, res) => {
  const state = mongoose.connection.readyState;
  res.json({ ok: true, mongo: state === 1 ? 'connected' : 'not_connected' });
});

// List orders
app.get('/api/orders', async (req, res) => {
  try {
    if (dbConnected) {
      const orders = await Order.find().sort({ date: -1 }).lean();
      return res.json(orders);
    } else {
      const sorted = [...memOrders].sort((a,b)=> new Date(b.date)-new Date(a.date));
      return res.json(sorted);
    }
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return res.status(500).json({ message: 'Serverfout' });
  }
});

// Get single order
app.get('/api/orders/:id', async (req, res) => {
  try {
    if (dbConnected) {
      const doc = await Order.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ message: 'Niet gevonden' });
      return res.json(doc);
    } else {
      const doc = memOrders.find(o => String(o._id) === String(req.params.id));
      if (!doc) return res.status(404).json({ message: 'Niet gevonden' });
      return res.json(doc);
    }
  } catch (error) {
    console.error('GET /api/orders/:id error:', error);
    return res.status(500).json({ message: 'Serverfout' });
  }
});

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const data = sanitizeOrderInput(req.body);
    if (!isValidOrder(data)){
      return res.status(400).json({ message: 'Alle velden zijn verplicht' });
    }

    const orderPayload = {
      scoop: data.scoop,
      cone: data.cone,
      sprinkles: data.sprinkles,
      customer: {
        name: data.customer.name,
        address: {
          street: data.customer.address.street,
          city: data.customer.address.city
        }
      },
      price: Number(data.price),
      status: 'pending',
      date: new Date()
    };

    if (dbConnected) {
      const created = await Order.create(orderPayload);
      return res.status(201).json(created);
    } else {
      const created = { _id: Date.now().toString(36), ...orderPayload };
      memOrders.push(created);
      return res.status(201).json(created);
    }
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return res.status(500).json({ message: 'Serverfout', error: error.message });
  }
});

// Update status (support both POST and PATCH routes)
async function updateStatusHandler(req, res){
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ message: 'status is verplicht' });

    if (dbConnected) {
      const doc = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
      if (!doc) return res.status(404).json({ message: 'Niet gevonden' });
      return res.json(doc);
    } else {
      const idx = memOrders.findIndex(o => String(o._id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ message: 'Niet gevonden' });
      memOrders[idx] = { ...memOrders[idx], status };
      return res.json(memOrders[idx]);
    }
  } catch (error) {
    console.error('UPDATE status error:', error);
    return res.status(500).json({ message: 'Serverfout' });
  }
}

app.post('/api/orders/:id/status', updateStatusHandler);
app.patch('/api/orders/:id/status', updateStatusHandler);

// Delete order
app.delete('/api/orders/:id', async (req, res) => {
  try {
    if (dbConnected) {
      const doc = await Order.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: 'Niet gevonden' });
      return res.json({ ok: true });
    } else {
      const idx = memOrders.findIndex(o => String(o._id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ message: 'Niet gevonden' });
      memOrders.splice(idx, 1);
      return res.json({ ok: true });
    }
  } catch (error) {
    console.error('DELETE /api/orders/:id error:', error);
    return res.status(500).json({ message: 'Serverfout' });
  }
});

// --- Start ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
