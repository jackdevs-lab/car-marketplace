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
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');
const winston = require('winston');

console.log('Starting server...');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.Console({ level: 'info', format: winston.format.simple() })
  ]
});

const prisma = new PrismaClient();
const port = process.env.PORT || 5000;
const app = express();

// Enhanced Helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-random123'", "https://cdnjs.cloudflare.com"], // Nonce will be dynamically set
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "https://res.cloudinary.com"],
      fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
      blockAllMixedContent: []
    }
  },
  referrerPolicy: { policy: 'same-origin' },
  xssFilter: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' }
}));

app.use(cookieParser());
app.use(csrf({ cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' } }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://car-marketplace-qkr3.vercel.app/' : 'http://localhost:5000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic CSP nonce middleware
app.use((req, res, next) => {
  res.locals.nonce = 'random123'; // In production, generate a unique nonce per request
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  //if (process.env.NODE_ENV === 'production' && !req.secure) {
   // return res.redirect(`https://${req.headers.host}${req.url}`);
  //}
  logger.info(`Request: ${req.method} ${req.url}`);
  next();
});

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});
app.use(globalLimiter);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests to this endpoint, please try again later.'
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.'
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/car/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'car-detail.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

const upload = multer({ storage: multer.memoryStorage() });

const authMiddleware = async (req, res, next) => {
  const token = req.cookies.authToken;
  if (!token) {
    logger.error('No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isAdmin) {
      logger.error('Invalid token or user is not admin');
      return res.status(403).json({ error: 'Unauthorized' });
    }
    req.user = user;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const validateCarData = (data) => {
  const { name, brand, price, mileage, year, color, description, phone, transmission, fuelType, location, engine } = data;
  if (!['Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes', 'Audi'].includes(brand)) return 'Invalid brand';
  const priceNum = parseInt(price);
  if (isNaN(priceNum) || priceNum < 0 || priceNum > 100000000) return 'Invalid price';
  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) return 'Invalid year';
  const phoneRegex = /^\+?\d{10,15}$/;
  if (!phoneRegex.test(phone)) return 'Invalid phone number';
  if (!['Automatic', 'Manual'].includes(transmission)) return 'Invalid transmission';
  if (!['Petrol', 'Diesel', 'Electric', 'Hybrid'].includes(fuelType)) return 'Invalid fuel type';
  if (!name || name.length > 100) return 'Invalid name';
  if (!mileage || mileage.length > 50) return 'Invalid mileage';
  if (!color || color.length > 50) return 'Invalid color';
  if (!description || description.length > 1000) return 'Invalid description';
  if (!location || location.length > 100) return 'Invalid location';
  if (!engine || engine.length > 50) return 'Invalid engine';
  return null;
};

app.get('/api/cars', apiLimiter, async (req, res) => {
  try {
    const cars = await prisma.car.findMany();
    res.json(cars);
  } catch (error) {
    logger.error('Error fetching cars:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/cars/:id', apiLimiter, async (req, res) => {
  try {
    const car = await prisma.car.findUnique({ where: { id: parseInt(req.params.id) } });
    if (car) res.json(car);
    else res.status(404).json({ error: 'Car not found' });
  } catch (error) {
    logger.error('Error fetching car:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/cars', authMiddleware, apiLimiter, upload.array('images', 10), async (req, res) => {
  try {
    const { name, brand, price, mileage, year, color, description, phone, transmission, fuelType, location, engine } = req.body;
    const validationError = validateCarData(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (req.files.some(file => !allowedTypes.includes(file.mimetype))) return res.status(400).json({ error: 'Only JPEG, PNG, and GIF images are allowed' });
    if (req.files.some(file => file.size > 5 * 1024 * 1024)) return res.status(400).json({ error: 'Images must be under 5MB' });

    const uploadPromises = req.files.map(file =>
      new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { resource_type: 'image', folder: 'cars', allowed_formats: ['jpg', 'png', 'gif'] },
          (error, result) => (error ? reject(new Error('Cloudinary upload failed: ' + error.message)) : resolve(result.secure_url))
        ).end(file.buffer);
      })
    );

    const imageUrls = await Promise.all(uploadPromises);

    const cleanData = {
      name: sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} }),
      brand,
      price: parseInt(price),
      mileage: sanitizeHtml(mileage, { allowedTags: [], allowedAttributes: {} }),
      year: parseInt(year),
      color: sanitizeHtml(color, { allowedTags: [], allowedAttributes: {} }),
      description: sanitizeHtml(description, { allowedTags: [], allowedAttributes: {} }),
      phone: sanitizeHtml(phone, { allowedTags: [], allowedAttributes: {} }),
      transmission,
      fuelType,
      location: sanitizeHtml(location, { allowedTags: [], allowedAttributes: {} }),
      engine: sanitizeHtml(engine, { allowedTags: [], allowedAttributes: {} })
    };

    const car = await prisma.car.create({ data: { ...cleanData, images: imageUrls, createdBy: req.user.id } });
    res.status(201).json(car);
  } catch (error) {
    logger.error('Error creating car:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/cars/:id', authMiddleware, apiLimiter, upload.array('images', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const car = await prisma.car.findUnique({ where: { id: parseInt(id) } });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    if (car.createdBy !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    const { name, brand, price, mileage, year, color, description, phone, transmission, fuelType, location, engine } = req.body;
    const validationError = validateCarData(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    let imageUrls = car.images;
    if (req.files && req.files.length > 0) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (req.files.some(file => !allowedTypes.includes(file.mimetype))) return res.status(400).json({ error: 'Only JPEG, PNG, and GIF images are allowed' });
      if (req.files.some(file => file.size > 5 * 1024 * 1024)) return res.status(400).json({ error: 'Images must be under 5MB' });

      const uploadPromises = req.files.map(file =>
        new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { resource_type: 'image', folder: 'cars', allowed_formats: ['jpg', 'png', 'gif'] },
            (error, result) => (error ? reject(new Error('Cloudinary upload failed: ' + error.message)) : resolve(result.secure_url))
          ).end(file.buffer);
        })
      );
      imageUrls = await Promise.all(uploadPromises);
    }

    const cleanData = {
      name: sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} }),
      brand,
      price: parseInt(price),
      mileage: sanitizeHtml(mileage, { allowedTags: [], allowedAttributes: {} }),
      year: parseInt(year),
      color: sanitizeHtml(color, { allowedTags: [], allowedAttributes: {} }),
      description: sanitizeHtml(description, { allowedTags: [], allowedAttributes: {} }),
      phone: sanitizeHtml(phone, { allowedTags: [], allowedAttributes: {} }),
      transmission,
      fuelType,
      location: sanitizeHtml(location, { allowedTags: [], allowedAttributes: {} }),
      engine: sanitizeHtml(engine, { allowedTags: [], allowedAttributes: {} })
    };

    const updatedCar = await prisma.car.update({
      where: { id: parseInt(id) },
      data: { ...cleanData, images: imageUrls }
    });
    res.json(updatedCar);
  } catch (error) {
    logger.error('Error updating car:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/cars/:id', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const car = await prisma.car.findUnique({ where: { id: parseInt(id) } });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    if (car.createdBy !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    await prisma.car.delete({ where: { id: parseInt(id) } });
    res.status(200).json({ message: 'Car deleted' });
  } catch (error) {
    logger.error('Error deleting car:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    logger.error('Missing username or password');
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) return res.status(400).json({ error: 'Password must meet complexity requirements' });

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isAdmin) {
      logger.error('User not found or not admin');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.error('Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 1000
    });
    logger.info('Login successful, token generated');
    res.json({ message: 'Login successful', csrfToken: req.csrfToken() });
  } catch (error) {
    logger.error('Error during login:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.use((err, req, res, next) => {
  logger.error('Global error:', err.message); // Avoid stack traces in production
  res.status(err.status || 500).json({ error: 'Server error' });
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;