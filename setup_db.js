const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function setup() {
    // 1. Connect to default 'postgres' database to create the new DB
    const config = {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        database: 'postgres' // Connect to default DB first
    };

    const client = new Client(config);

    try {
        await client.connect();

        // Check if database exists
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME}'`);
        if (res.rowCount === 0) {
            console.log(`Creating database '${process.env.DB_NAME}'...`);
            await client.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
        } else {
            console.log(`Database '${process.env.DB_NAME}' already exists.`);
        }

        await client.end();

        // 2. Connect to the new database and run schema
        const dbClient = new Client({
            ...config,
            database: process.env.DB_NAME
        });

        await dbClient.connect();
        console.log('Applying schema...');

        const schema = fs.readFileSync('schema.sql', 'utf-8');
        await dbClient.query(schema);

        console.log('✅ Database setup complete!');
        await dbClient.end();

    } catch (err) {
        console.error('❌ Setup Failed:', err.message);
        console.error('Make sure PostgreSQL is running and credentials in .env are correct.');
        if (err.code === '28P01') {
            console.error('Authentication failed. Check DB_PASSWORD in .env');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('Connection refused. Is PostgreSQL server running?');
        }
    }
}

setup();
