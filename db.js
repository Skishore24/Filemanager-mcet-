/* ============================================================
   db.js — MySQL Connection Pool
   Creates a shared database connection pool used by all routes.
   Import this file anywhere you need to run a DB query.
   ============================================================ */

const mysql  = require("mysql2");
require("dotenv").config();

/* ---- Create connection pool --------------------------------
   Using a pool (not single connection) so multiple requests
   can share connections efficiently without bottlenecks.
   ------------------------------------------------------------ */
const db = mysql.createPool({
  host:             process.env.DB_HOST,
  user:             process.env.DB_USER,
  password:         process.env.DB_PASS,
  database:         process.env.DB_NAME,
  waitForConnections: true, /* Queue requests if all connections busy */
  connectionLimit:  10,     /* Max simultaneous connections           */
  queueLimit:       0       /* Unlimited queue (0 = no limit)         */
});

/* ---- Test the connection on startup -----------------------
   Grabs one connection to verify credentials and connectivity.
   Releases it back to the pool immediately after.
   ------------------------------------------------------------ */
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ MySQL connection failed:", err.message);
  } else {
    console.log("✅ MySQL connected successfully");
    connection.release(); /* Always release back to pool */
  }
});

/* Export the pool — use db.query() or db.promise().query() */
module.exports = db;
