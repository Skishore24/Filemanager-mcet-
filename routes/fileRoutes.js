/* ============================================================
   routes/fileRoutes.js — File Upload, List, Edit, Delete
   GET    /api/files            — List all files (admin only)
   POST   /api/files            — Upload a new file (admin only)
   DELETE /api/files/:id        — Delete a file (admin only)
   PUT    /api/files/:id        — Rename / re-categorize a file (admin only)
   PUT    /api/files/importance/:id — Toggle view-only restriction (admin only)
   ============================================================ */

const express     = require("express");
const router      = express.Router();
const db          = require("../db");
const multer      = require("multer");
const fs          = require("fs");
const path        = require("path");
const verifyAdmin = require("../middleware/verifyAdmin");


/* ============================================================
   MULTER CONFIGURATION
   Controls where files are stored and what is allowed.
   ============================================================ */

/* Store uploaded files in the /uploads directory */
const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },

  /* Sanitize filename: remove special chars, prefix with timestamp */
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, Date.now() + "-" + safeName);
  }

});

/* Allowed MIME types and file extensions */
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];

/* Multer middleware with size limit and file type filter */
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024  /* 10 MB max */
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    /* Reject if MIME type or extension is not in whitelist */
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error("Invalid file type. Only PDF, JPG, PNG, DOC, DOCX allowed."));
    }
    cb(null, true);
  }
});



/* ============================================================
   GET /api/files
   PUBLIC — No authentication required.
   The student portal needs this to display the file list.
   Returns only safe metadata columns (filepath is excluded).
   Upload/Delete/Edit routes below remain admin-protected.
   ============================================================ */
router.get("/", (req, res) => {

  db.query(
    "SELECT id, name, category, size, importance, date FROM files",
    (err, result) => {
      if (err) return res.status(500).json({ error: "Failed to load files" });
      res.json(result);
    }
  );

});


/* ============================================================
   POST /api/files
   Uploads a file to /uploads and saves a record in the DB.
   ============================================================ */
router.post("/", verifyAdmin, upload.single("file"), (req, res) => {

  /* Multer will set req.file if upload succeeded */
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  /* Build values for the DB insert */
  const name      = req.file.filename;
  const filepath  = "/uploads/" + req.file.filename;
  const category  = (req.body.category  || "General").trim();
  const size      = (req.file.size / 1024).toFixed(1) + " KB";
  const importance = req.body.importance || "less";  /* "less" = view+download, "important" = view only */

  db.query(
    "INSERT INTO files (name, filepath, category, size, importance) VALUES (?, ?, ?, ?, ?)",
    [name, filepath, category, size, importance],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to save file record" });
      res.json({ success: true });
    }
  );

});


/* ============================================================
   DELETE /api/files/:id
   Deletes the physical file from disk and removes DB record.
   ============================================================ */
router.delete("/:id", verifyAdmin, (req, res) => {

  /* First fetch the file record to get the filename for disk deletion */
  db.query("SELECT * FROM files WHERE id = ?", [req.params.id], (err, result) => {

    if (err) return res.status(500).json({ error: "Database error" });
    if (result.length === 0) return res.sendStatus(404);

    const file     = result[0];
    const filePath = path.join(__dirname, "../uploads", file.name);

    /* Delete the physical file from disk if it still exists */
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error("Error deleting file from disk:", unlinkErr.message);
      }
    }

    /* Remove the DB record regardless of whether disk file existed */
    db.query("DELETE FROM files WHERE id = ?", [req.params.id], (delErr) => {
      if (delErr) return res.status(500).json({ error: "Failed to delete file record" });
      res.json({ success: true });
    });

  });

});


/* ============================================================
   PUT /api/files/:id
   Renames a file (both on disk and in DB) and updates
   its category and importance level.
   ============================================================ */
router.put("/:id", verifyAdmin, (req, res) => {

  const { name, category, importance } = req.body;
  const id = req.params.id;

  /* Fetch the current file record to get original name/extension */
  db.query("SELECT * FROM files WHERE id = ?", [id], (err, result) => {

    if (err) return res.status(500).json({ error: "Database error" });
    if (result.length === 0) return res.status(404).json({ error: "File not found" });

    const oldFile = result[0];

    /* Preserve the original file extension when renaming */
    const ext         = path.extname(oldFile.name);
    const safeName    = name.replace(/[^a-zA-Z0-9_-]/g, "");
    const newFileName = safeName + ext;

    const oldPath = path.join(__dirname, "../uploads", oldFile.name);
    const newPath = path.join(__dirname, "../uploads", newFileName);

    /* Check if another file already has the new name */
    db.query(
      "SELECT id FROM files WHERE name = ? AND id != ?",
      [newFileName, id],
      (dupErr, dupResult) => {

        /* Always check query error before accessing results */
        if (dupErr) return res.status(500).json({ error: "Database error during rename check" });

        if (dupResult && dupResult.length > 0) {
          return res.status(400).json({ error: "A file with this name already exists" });
        }

        /* Rename the physical file on disk (only if name actually changed) */
        if (oldFile.name !== newFileName && fs.existsSync(oldPath)) {
          try {
            fs.renameSync(oldPath, newPath);
          } catch (renameErr) {
            return res.status(500).json({ error: "Failed to rename file on disk" });
          }
        }

        /* Update the DB record with new name, path, category, importance */
        db.query(
          "UPDATE files SET name = ?, filepath = ?, category = ?, importance = ? WHERE id = ?",
          [newFileName, "/uploads/" + newFileName, category, importance, id],
          (updateErr) => {
            if (updateErr) return res.status(500).json({ error: "Failed to update file record" });
            res.json({ success: true });
          }
        );

      }
    );

  });

});


/* ============================================================
   PUT /api/files/importance/:id
   Quick-toggle: sets a file as "view only" or "view + download".
   importance = "important" → view only (no download button)
   importance = "less"      → view and download allowed
   ============================================================ */
router.put("/importance/:id", verifyAdmin, (req, res) => {

  const { importance } = req.body;

  db.query(
    "UPDATE files SET importance = ? WHERE id = ?",
    [importance, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to update importance" });
      res.json({ success: true });
    }
  );

});

module.exports = router;
