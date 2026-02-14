const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const componentRoutes = require('./routes/componentRoutes');
const pcbRoutes = require('./routes/pcbRoutes');
const productionRoutes = require('./routes/productionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const procurementRoutes = require('./routes/procurementRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/pcb-types', pcbRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/reports', reportRoutes);

// Error Handler (must be last)
app.use(errorHandler);

// Start Server
const startServer = async () => {
    const dbConnected = await testConnection();

    if (!dbConnected) {
        console.error('WARNING: Database connection failed. Server will start but database features will not work.');
        console.error('Make sure PostgreSQL is running and the database "invictus_inventory" exists.');
        console.error('Run: createdb invictus_inventory');
        console.error('Then: psql -d invictus_inventory -f ../database/schema.sql');
    }

    app.listen(PORT, () => {
        console.log(`\n  Invictus Inventory Backend`);
        console.log(`  Server running on http://localhost:${PORT}`);
        console.log(`  Database: ${dbConnected ? 'Connected' : 'Not Connected'}`);
        console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
};

startServer();

module.exports = app;
