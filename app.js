// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

// Import route files
const adminRoutes = require('./routes/admin');
const facultyRoutes = require('./routes/faculty');
const studentRoutes = require('./routes/student');
const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Connect to Database
async function connectDB() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
    });

    console.log("✔ MySQL Database Connected Successfully!");

    // Make pool available for routes
    app.locals.pool = pool;

    // Mount all routes
    app.use('/admin', adminRoutes);    
    app.use('/faculty', facultyRoutes);
    app.use('/student', studentRoutes);
    app.use('/auth', authRoutes);

    // Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );

  } catch (err) {
    console.error("Database Connection Failed:", err);
    process.exit(1);
  }
}

connectDB();
