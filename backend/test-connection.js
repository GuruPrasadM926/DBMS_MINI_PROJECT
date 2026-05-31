require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_ADMIN_USER,
      password: process.env.DB_ADMIN_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });

    const conn = await pool.getConnection();
    console.log('Connected to database as', process.env.DB_ADMIN_USER);

    const [vars] = await conn.query("SELECT VERSION() AS version, NOW() AS now");
    console.log('Server info:', vars[0]);

    // Quick sanity check: does clinic_staff table exist? show a single row count if present
    try {
      const [countRows] = await conn.query('SELECT COUNT(*) AS cnt FROM clinic_staff');
      console.log('clinic_staff rows:', countRows[0].cnt);
    } catch (tblErr) {
      console.log('clinic_staff check failed (table may not exist yet):', tblErr.message);
    }

    conn.release();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  }
})();