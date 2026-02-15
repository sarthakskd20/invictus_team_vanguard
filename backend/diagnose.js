const { pool } = require('./config/database');

async function diagnose() {
    try {
        console.log('🔍 Diagnosing authentication issue...\n');

        // Test 1: Database connection
        console.log('[1/4] Testing database connection...');
        const timeResult = await pool.query('SELECT NOW()');
        console.log('✅ Database connected:', timeResult.rows[0].now);

        // Test 2: Check if users table exists
        console.log('\n[2/4] Checking users table...');
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );
        `);
        console.log('✅ Users table exists:', tableCheck.rows[0].exists);

        // Test 3: Count users
        console.log('\n[3/4] Checking user count...');
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        console.log('📊 Total users:', userCount.rows[0].count);

        // Test 4: Check if admin exists
        console.log('\n[4/4] Checking for admin user...');
        const adminCheck = await pool.query('SELECT username, email, role FROM users WHERE username = $1', ['admin']);

        if (adminCheck.rows.length > 0) {
            console.log('✅ Admin user found:');
            console.log('   Username:', adminCheck.rows[0].username);
            console.log('   Email:', adminCheck.rows[0].email);
            console.log('   Role:', adminCheck.rows[0].role);
        } else {
            console.log('❌ Admin user NOT found!');
            console.log('\n🔧 Creating admin user...');
            const bcrypt = require('bcrypt');
            const passwordHash = await bcrypt.hash('admin123', 10);

            const result = await pool.query(
                'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING username, email, role',
                ['admin', 'admin@electrolyte.com', passwordHash, 'admin']
            );
            console.log('✅ Admin user created:', result.rows[0]);
        }

        console.log('\n✅ Diagnosis complete!');
        console.log('\nDefault credentials:');
        console.log('   Username: admin');
        console.log('   Password: admin123');

    } catch (error) {
        console.error('❌ Error during diagnosis:', error.message);
        console.error('\nFull error:', error);
    } finally {
        await pool.end();
    }
}

diagnose();
