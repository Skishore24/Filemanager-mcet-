/* ============================================================
   routes/categoriesRoutes.js — File Category CRUD
   GET    /api/categories       — List all categories (public)
   POST   /api/categories       — Add a category (admin only)
   DELETE /api/categories/:id   — Delete a category (admin only)
   PUT    /api/categories/:id   — Rename a category (admin only)
   ============================================================ */

const express     = require("express");
const router      = express.Router();
const db          = require("../db");
const verifyAdmin = require("../middleware/verifyAdmin");


/* ============================================================
   GET /api/categories
   Returns all categories. Public — no auth needed.
   Used by user page to populate the category filter dropdown.
   ============================================================ */
router.get("/", (req, res) => {

  db.query("SELECT * FROM categories", (err, result) => {
    if (err) return res.status(500).json({ error: "Failed to load categories" });
    res.json(result);
  });

});


/* ============================================================
   POST /api/categories
   Creates a new category.
   Name must be at least 2 characters long.
   ============================================================ */
router.post("/", verifyAdmin, (req, res) => {

  const { name } = req.body;

  /* Validate: name must exist and be at least 2 characters */
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Category name must be at least 2 characters" });
  }

  db.query(
    "INSERT INTO categories (name) VALUES (?)",
    [name.trim()],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to create category" });
      res.json({ success: true });
    }
  );

});


/* ============================================================
   DELETE /api/categories/:id
   Deletes a category by ID.
   Returns 404 if the category does not exist.
   ============================================================ */
router.delete("/:id", verifyAdmin, (req, res) => {

  const id = req.params.id;

  /* Check the category exists before attempting to delete */
  db.query("SELECT id FROM categories WHERE id = ?", [id], (err, rows) => {

    if (err) return res.status(500).json({ error: "Database error" });

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    /* Category exists — go ahead and delete */
    db.query("DELETE FROM categories WHERE id = ?", [id], (delErr) => {
      if (delErr) return res.status(500).json({ error: "Failed to delete category" });
      res.json({ success: true });
    });

  });

});


/* ============================================================
   PUT /api/categories/:id
   Renames an existing category.
   Name must be at least 2 characters.
   ============================================================ */
router.put("/:id", verifyAdmin, (req, res) => {

  const { name } = req.body;

  /* Validate new name */
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Category name must be at least 2 characters" });
  }

  db.query(
    "UPDATE categories SET name = ? WHERE id = ?",
    [name.trim(), req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to update category" });
      res.json({ success: true });
    }
  );

});

module.exports = router;
