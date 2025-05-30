require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const rateLimit = require('express-rate-limit');

console.log('Starting server...');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();
const port = process.env.PORT || 5000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit to 5 requests per window
  message: 'Too many login attempts, please try again later.',
});

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

// Car detail route
app.get('/car/:id', (req, res) => {
  console.log('Serving car-detail.html');
  res.sendFile(path.join(__dirname, 'public', 'car-detail.html'));
});

// Admin route
app.get('/admin', (req, res) => {
  console.log('Serving admin.html');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Multer configuration for temporary file storage
const upload = multer({ storage: multer.memoryStorage() });

// JWT authentication middleware
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    console.log('No authorization header provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isAdmin) {
      console.log('Invalid token or user is not admin');
      return res.status(403).json({ error: 'Unauthorized' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// API Routes
// Public endpoint to fetch all cars
app.get('/api/cars', async (req, res) => {
  try {
    const cars = await prisma.car.findMany();
    console.log('Fetched cars:', cars);
    res.json(cars);
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ error: 'Error fetching cars' });
  }
});

// Public endpoint to fetch a single car by ID
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

app.post('/api/cars', authMiddleware, upload.array('images', 10), async (req, res) => {
  try {
    const { name, brand, price, mileage, year, color, description, phone, transmission, fuelType, location, engine } = req.body;

    if (!name || !brand || !price || !mileage || !year || !color || !description || !phone || !transmission || !fuelType || !location || !engine) {
      return res.status(400).json({ error: 'All fields are required' });
    }

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
        fuelType,
        location,
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

app.put('/api/cars/:id', authMiddleware, upload.array('images', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, price, mileage, year, color, description, phone, transmission, fuelType, location, engine } = req.body;

    if (!name || !brand || !price || !mileage || !year || !color || !description || !phone || !transmission || !fuelType || !location || !engine) {
      return res.status(400).json({ error: 'All fields are required' });
    }

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
        fuelType,
        location,
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

app.delete('/api/cars/:id', authMiddleware, async (req, res) => {
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
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    console.log('Missing username or password');
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isAdmin) {
      console.log('User not found or not admin');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Login successful, token generated');
    res.json({ token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Error during login' });
  }
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