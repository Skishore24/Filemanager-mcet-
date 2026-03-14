/* ============================================================
   routes/userRoutes.js — User Block/Unblock & Activity Tracking
   POST /api/users/check-block  — Check if a mobile is blocked (public)
   POST /api/users/block        — Block a mobile number (admin only)
   POST /api/users/unblock      — Unblock a mobile number (admin only)
   GET  /api/users/blocked      — List all blocked numbers (admin only)
   POST /api/users/heartbeat    — Update user's last-active timestamp
   POST /api/users/offline      — Mark user as offline (last_active = 1 min ago)
   ============================================================ */

const express     = require("express");
const router      = express.Router();
const db          = require("../db");
const verifyAdmin = require("../middleware/verifyAdmin");


/* ============================================================
   POST /api/users/check-block
   Called by the user page before opening a file.
   Returns { blocked: true/false } for the given mobile number.
   Public — does not require login.
   ============================================================ */
router.post("/check-block", (req, res) => {

  const { mobile } = req.body;

  if (!mobile) return res.status(400).json({ error: "Mobile number is required" });

  db.query(
    "SELECT * FROM blocked_users WHERE mobile = ?",
    [mobile],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });

      /* Returns true if the mobile was found in the blocked_users table */
      res.json({ blocked: result.length > 0 });
    }
  );

});


/* ============================================================
   POST /api/users/block
   Adds a mobile number to the blocked_users table.
   INSERT IGNORE prevents duplicate block entries.
   ============================================================ */
router.post("/block", verifyAdmin, (req, res) => {

  const { mobile } = req.body;

  if (!mobile) return res.status(400).json({ success: false, error: "Mobile number is required" });

  db.query(
    "INSERT IGNORE INTO blocked_users (mobile) VALUES (?)",
    [mobile],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: "Failed to block user" });
      res.json({ success: true });
    }
  );

});


/* ============================================================
   POST /api/users/unblock
   Removes a mobile number from the blocked_users table.
   ============================================================ */
router.post("/unblock", verifyAdmin, (req, res) => {

  const { mobile } = req.body;

  if (!mobile) return res.status(400).json({ success: false, error: "Mobile number is required" });

  db.query(
    "DELETE FROM blocked_users WHERE mobile = ?",
    [mobile],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to unblock user" });
      res.json({ success: true });
    }
  );

});


/* ============================================================
   GET /api/users/blocked
   Returns a list of all currently blocked mobile numbers.
   ============================================================ */
router.get("/blocked", verifyAdmin, (req, res) => {

  db.query("SELECT mobile FROM blocked_users", (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(result);
  });

});


/* ============================================================
   POST /api/users/heartbeat
   Called every 60 seconds by the user page while a file is open.
   Updates last_active to NOW() for the most recent view log row.
   The dashboard uses last_active to show who is currently online.
   ============================================================ */
router.post("/heartbeat", (req, res) => {

  const { mobile } = req.body;

  if (!mobile) return res.json({ success: false });

  /* Update only the most recent view_log row for this mobile */
  db.query(
    `UPDATE view_logs
     SET last_active = NOW()
     WHERE id = (
       SELECT id FROM (
         SELECT id FROM view_logs
         WHERE mobile = ?
         ORDER BY viewed_at DESC
         LIMIT 1
       ) AS t
     )`,
    [mobile],
    (err) => {
      if (err) {
        console.error("Heartbeat update error:", err.message);
        return res.json({ success: false });
      }
      res.json({ success: true });
    }
  );

});


/* ============================================================
   POST /api/users/offline
   Called via navigator.sendBeacon when the user closes the tab.
   Sets last_active to 1 minute ago so the dashboard shows them offline.
   ============================================================ */
router.post("/offline", (req, res) => {

  const { mobile } = req.body;

  if (!mobile) return res.json({ success: false });

  db.query(
    `UPDATE view_logs
     SET last_active = DATE_SUB(NOW(), INTERVAL 1 MINUTE)
     WHERE id = (
       SELECT id FROM (
         SELECT id FROM view_logs
         WHERE mobile = ?
         ORDER BY viewed_at DESC
         LIMIT 1
       ) AS t
     )`,
    [mobile],
    () => res.json({ success: true })
  );

});

module.exports = router;
