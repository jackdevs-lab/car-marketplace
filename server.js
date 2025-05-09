require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const session = require('express-session');
const cloudinary = require('cloudinary').v2;

// Log server startup
console.log('Starting server...');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

// Log incoming requests
app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.url}`);
  next();
});

// Static file serving from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route to serve index.html
app.get('/', (req, res) => {
  console.log('Serving index.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Multer configuration for temporary file storage
const upload = multer({ storage: multer.memoryStorage() });

// Admin authentication middleware
const authMiddleware = (req, res, next) => {
  if (!req.session.isAdmin) {
    console.log('User not authenticated, redirecting to login');
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
    console.error('Error fetching cars:', error);
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
    console.error('Error fetching car:', error);
    res.status(500).json({ error: 'Error fetching car' });
  }
});

app.post('/api/cars', upload.array('images', 10), async (req, res) => {
  try {
    const { name, brand, price, mileage, year, color, description, phone, transmission, engine } = req.body;

    const uploadPromises = req.files.map(file =>
      new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
          if (error) reject(new Error('Cloudinary upload failed'));
          resolve(result.secure_url);
        }).end(file.buffer);
      })
    );

    const imageUrls = await Promise.all(uploadPromises);

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
        images: imageUrls,
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

    let imageUrls;
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file =>
        new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
            if (error) reject(new Error('Cloudinary upload failed'));
            resolve(result.secure_url);
          }).end(file.buffer);
        })
      );
      imageUrls = await Promise.all(uploadPromises);
    }

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
        images: imageUrls || undefined,
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
  console.log('Serving login.html');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    req.session.isAdmin = true;
    console.log('Login successful, redirecting to admin');
    res.redirect('/admin');
  } else {
    console.log('Login failed: Invalid credentials');
    res.status(401).send('Invalid credentials');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    console.log('Logged out, redirecting to login');
    res.redirect('/login');
  });
});

// Admin Route
app.get('/admin', authMiddleware, (req, res) => {
  console.log('Serving admin.html');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server locally, export for Vercel
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;