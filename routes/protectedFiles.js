const express = require("express");
const router = express.Router();
const path = require("path");
const db = require("../db");
const fs = require("fs");

/* DOWNLOAD FILE */
router.get("/download/:filename", async (req, res) => {
  try {

    const filename = path.basename(req.params.filename);
    if(!/^[a-zA-Z0-9._-]+$/.test(filename)){
 return res.status(400).send("Invalid filename");
}
    const mobile = req.query.mobile || "Admin";
    const device = req.headers["user-agent"] || "Unknown";

const filePath = path.join(__dirname, "..", "uploads", filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found");
    }

    await db.promise().query(
      `INSERT INTO view_logs (file_name, mobile, device, action, viewed_at)
       VALUES (?, ?, ?, 'download', NOW())`,
      [filename, mobile, device]
    );
res.setHeader("X-Content-Type-Options","nosniff");
res.setHeader("Cache-Control","no-store");
    res.download(filePath);

  } catch (err) {
    console.log(err);
    res.status(500).send("Download error");
  }
});

/* VIEW FILE */
router.get("/:filename", async (req, res) => {

 const mobile = req.query.mobile || "Admin";

 // allow admin access without mobile
 if(mobile !== "Admin" && mobile.length < 10){
    return res.status(403).send("Access denied");
 }

 const filename = path.basename(req.params.filename);

 if(!/^[a-zA-Z0-9._-]+$/.test(filename)){
  return res.status(400).send("Invalid filename");
 }

  try {

    const [rows] = await db.promise().query(
      "SELECT * FROM files WHERE name=?",
      [filename]
    );

    if (rows.length === 0) {
      return res.status(404).send("File not found");
    }

    const filePath = path.join(__dirname, "..", "uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File missing");
    }

    
    const device = req.headers["user-agent"] || "Unknown";

    await db.promise().query(
      `INSERT INTO view_logs
       (file_name, mobile, device, action, viewed_at)
       VALUES (?, ?, ?, 'view', NOW())`,
      [filename, mobile, device]
    );
    res.setHeader("Content-Disposition","inline");
    res.setHeader("Cache-Control","no-store");
    res.setHeader("Pragma","no-cache");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("X-Frame-Options","SAMEORIGIN");
    res.setHeader("Referrer-Policy","no-referrer");
    res.setHeader("X-XSS-Protection","1; mode=block");
    res.sendFile(filePath);

  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;