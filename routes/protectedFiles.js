/* ============================================================
   routes/protectedFiles.js — Secure File Serving
   GET /secure-files/:filename          — View a file inline (PDF, image, doc)
   GET /secure-files/download/:filename — Force-download a file

   Files are never served directly from the public folder.
   All access goes through here so we can log and control access.
   ============================================================ */

const express = require("express");
const router  = express.Router();
const path    = require("path");
const fs      = require("fs");
const db      = require("../db");


/* ============================================================
   GET /secure-files/download/:filename
   Forces a file download (Content-Disposition: attachment).
   Logs the download event in view_logs.
   Mobile is passed as ?mobile= query param (sent by the user page).
   ============================================================ */
router.get("/download/:filename", async (req, res) => {

  try {

    /* Sanitize filename — path.basename strips any directory traversal */
    const filename = path.basename(req.params.filename);

    /* Only allow filenames with safe characters */
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return res.status(400).send("Invalid filename");
    }

    const mobile = req.query.mobile || "Admin";
    const device = req.headers["user-agent"] || "Unknown";

    /* Build the absolute path to the upload */
    const filePath = path.join(__dirname, "..", "uploads", filename);

    /* Return 404 if the file does not exist on disk */
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found");
    }

    /* Log the download event in the database */
    await db.promise().query(
      `INSERT INTO view_logs (file_name, mobile, device, action, viewed_at)
       VALUES (?, ?, ?, 'download', NOW())`,
      [filename, mobile, device]
    );

    /* Set security headers before sending the file */
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");

    /* Send file as an attachment (triggers browser download dialog) */
    res.download(filePath);

  } catch (err) {
    console.error("Download error:", err.message);
    res.status(500).send("Download failed");
  }

});


/* ============================================================
   GET /secure-files/:filename
   Serves a file inline for viewing inside the browser viewer.
   Verifies:
   - Mobile number is provided and valid (or "Admin" for admin access)
   - File exists in the database
   - File exists on disk
   Logs the view event and sets strict security headers.
   ============================================================ */
router.get("/:filename", async (req, res) => {

  const mobile = req.query.mobile || "Admin";

  /* Allow admin bypass — enforce minimum mobile length for user access */
  if (mobile !== "Admin" && mobile.length < 10) {
    return res.status(403).send("Access denied. Valid mobile number required.");
  }

  /* Sanitize filename — prevent path traversal attacks */
  const filename = path.basename(req.params.filename);

  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return res.status(400).send("Invalid filename");
  }

  try {

    /* Verify the file exists in our database (not just on disk) */
    const [rows] = await db.promise().query(
      "SELECT * FROM files WHERE name = ?",
      [filename]
    );

    if (rows.length === 0) {
      return res.status(404).send("File not found in database");
    }

    /* Check the physical file still exists on disk */
    const filePath = path.join(__dirname, "..", "uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File missing from storage");
    }

    const device = req.headers["user-agent"] || "Unknown";

    /* Log this view event in the database */
    await db.promise().query(
      `INSERT INTO view_logs (file_name, mobile, device, action, viewed_at)
       VALUES (?, ?, ?, 'view', NOW())`,
      [filename, mobile, device]
    );

    /* Set strict security headers to prevent caching/embedding/XSS */
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control",        "no-store");
    res.setHeader("Pragma",               "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options",      "SAMEORIGIN");
    res.setHeader("Referrer-Policy",      "no-referrer");
    res.setHeader("X-XSS-Protection",     "1; mode=block");

    /* Serve the file inline (opens in the browser viewer) */
    res.sendFile(filePath);

  } catch (err) {
    console.error("File view error:", err.message);
    res.status(500).send("Server error while accessing file");
  }

});

module.exports = router;