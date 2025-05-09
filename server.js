require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const session = require('express-session');

const prisma = new PrismaClient();
const port = process.env.PORT || 5000;

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use(express.static(path.join(__dirname, 'car-marketplace')));

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Admin authentication middleware
const authMiddleware = (req, res, next) => {
  if (!req.session.isAdmin) {
    return res.redirect('/login');
  }
  next();
};

// API Routes
app.get('/api/cars', async (req, res) => {
  try {
    const cars = await prisma.car.findMany();
    res.json(cars);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching cars' });
  }
});

app.get('/api/cars/:id', async (req, res) => {
  try {
    const car = await prisma.car.findUnique({ where: { id: parseInt(req.params.id) } });
    if (car) {
      res.json(car);
    } else {
      res.status(404).json({ error: 'Car not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error fetching car' });
  }
});

app.post('/api/cars', upload.array('images', 10), async (req, res) => {
  try {
    const { name, brand, price, mileage, year, color, description, phone, transmission, engine } = req.body;
    const images = req.files.map(file => `/uploads/${file.filename}`);

    const car = await prisma.car.create({
      data: {
        name,
        brand,
        price: parseInt(price),
        mileage,
        year: parseInt(year),
        color,
        description,
        phone,
        transmission,
        engine,
        images,
      },
    });
    res.status(201).json(car);
  } catch (error) {
    console.error('Error creating car:', error);
    res.status(500).json({ error: 'Error creating car' });
  }
});

app.put('/api/cars/:id', upload.array('images', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, price, mileage, year, color, description, phone, transmission, engine } = req.body;
    const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : undefined;

    const car = await prisma.car.update({
      where: { id: parseInt(id) },
      data: {
        name,
        brand,
        price: parseInt(price),
        mileage,
        year: parseInt(year),
        color,
        description,
        phone,
        transmission,
        engine,
        images: images || undefined,
      },
    });
    res.json(car);
  } catch (error) {
    console.error('Error updating car:', error);
    res.status(500).json({ error: 'Error updating car' });
  }
});

app.delete('/api/cars/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.car.delete({ where: { id: parseInt(id) } });
    res.status(200).json({ message: 'Car deleted' });
  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({ error: 'Error deleting car' });
  }
});

// Login Route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'car-marketplace', 'login.html'));
});

app.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.status(401).send('Invalid credentials');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Admin Route
app.get('/admin', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'car-marketplace', 'admin.html'));
});

// Start Server
module.exports=app;