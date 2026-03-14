/* ============================================================
   routes/logRoutes.js — View/Download Log Management
   POST /api/save-view               — Log a file view event (public)
   POST /api/save-download           — Log a file download event (public)
   GET  /api/logs                    — List logs with search/filter/pagination (admin)
   GET  /api/logs/export             — Export all logs as Excel (admin)
   DELETE /api/logs/:id              — Delete a single log entry (admin)
   POST /api/users/delete-user-logs  — Delete all logs for a mobile number (admin)
   ============================================================ */

const express     = require("express");
const router      = express.Router();
const db          = require("../db");
const verifyAdmin = require("../middleware/verifyAdmin");
const ExcelJS     = require("exceljs");


/* ============================================================
   HELPER — Extract the real client IP address.
   Priority: body-provided IP → X-Forwarded-For header → socket → req.ip
   Note: body IP is user-provided and can be spoofed.
   ============================================================ */
function getClientIp(req, bodyIp) {
  return (
    bodyIp ||
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "Unknown"
  );
}


/* ============================================================
   POST /api/save-view
   Logs that a user opened/viewed a file.
   Called by the user page immediately when a file is opened.
   ============================================================ */
router.post("/save-view", (req, res) => {

  const { file, name, mobile, country, state, device, ip: bodyIp } = req.body;

  /* Both file and mobile are required to create a meaningful log */
  if (!file || !mobile) {
    return res.status(400).json({ error: "File name and mobile number are required" });
  }

  const ip = getClientIp(req, bodyIp);

  db.query(
    "INSERT INTO view_logs (file_name, name, mobile, ip, country, state, device, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [file, name, mobile, ip, country, state, device, "view"],
    (err) => {
      if (err) {
        console.error("Save view log error:", err.message);
        return res.json({ success: false });
      }
      res.json({ success: true });
    }
  );

});


/* ============================================================
   POST /api/save-download
   Logs that a user downloaded a file.
   Called by the user page when the download button is clicked.
   ============================================================ */
router.post("/save-download", (req, res) => {

  const { file, name, mobile, country, state, device, ip: bodyIp } = req.body;

  /* Both file and mobile are required */
  if (!file || !mobile) {
    return res.status(400).json({ error: "File name and mobile number are required" });
  }

  const ip = getClientIp(req, bodyIp);

  db.query(
    "INSERT INTO view_logs (file_name, name, mobile, ip, country, state, device, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [file, name, mobile, ip, country, state, device, "download"],
    (err) => {
      if (err) {
        console.error("Save download log error:", err.message);
        return res.json({ success: false });
      }
      res.json({ success: true });
    }
  );

});


/* ============================================================
   GET /api/logs
   Returns paginated, searchable, filterable view logs for the admin.

   Query params:
   - search   : filter by file name or mobile
   - date     : filter by date (YYYY-MM-DD)
   - category : filter by category (applied to file_name LIKE)
   - sort     : "ASC" or "DESC" (default DESC — newest first)
   - page     : page number (default 1)
   - limit    : rows per page (default 10)
   ============================================================ */
router.get("/logs", verifyAdmin, (req, res) => {

  const search   = req.query.search   || "";
  const date     = req.query.date     || "";
  const category = req.query.category || "All";
  const sort     = (req.query.sort || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  /* Start with a base WHERE clause and build up dynamically */
  let where  = "WHERE 1 = 1";
  let params = [];

  if (search) {
    where += " AND (file_name LIKE ? OR mobile LIKE ?)";
    params.push("%" + search + "%", "%" + search + "%");
  }

  if (date) {
    where += " AND viewed_at LIKE ?";
    params.push(date + "%");
  }

  if (category !== "All") {
    where += " AND file_name LIKE ?";
    params.push("%" + category + "%");
  }

  /* Get total row count first for pagination calculation */
  const countQuery = `SELECT COUNT(*) AS total FROM view_logs ${where}`;
  const dataQuery  = `SELECT * FROM view_logs ${where} ORDER BY viewed_at ${sort} LIMIT ? OFFSET ?`;

  db.query(countQuery, params, (err, countResult) => {

    if (err) {
      console.error("Log count error:", err.message);
      return res.status(500).json({ error: "Failed to query logs" });
    }

    const totalRows  = countResult[0].total;
    const totalPages = Math.ceil(totalRows / limit);

    /* Fetch the page of data */
    db.query(dataQuery, [...params, limit, offset], (dataErr, result) => {

      if (dataErr) {
        console.error("Log fetch error:", dataErr.message);
        return res.status(500).json({ error: "Failed to fetch logs" });
      }

      res.json({ logs: result, totalPages });
    });

  });

});


/* ============================================================
   GET /api/logs/export
   Exports ALL view logs as a downloadable Excel (.xlsx) file.
   Used by admin to save/share log data offline.
   ============================================================ */
router.get("/logs/export", verifyAdmin, async (req, res) => {

  db.query("SELECT * FROM view_logs ORDER BY viewed_at DESC", async (err, rows) => {

    if (err) {
      return res.status(500).json({ error: "Failed to fetch logs for export" });
    }

    /* Build Excel workbook with ExcelJS */
    const workbook = new ExcelJS.Workbook();
    const sheet    = workbook.addWorksheet("View Logs");

    /* Define column headers and widths */
    sheet.columns = [
      { header: "File",      key: "file_name", width: 30 },
      { header: "Name",      key: "name",      width: 20 },
      { header: "Mobile",    key: "mobile",    width: 20 },
      { header: "IP",        key: "ip",        width: 20 },
      { header: "Viewed At", key: "viewed_at", width: 25 }
    ];

    /* Add each log row to the sheet */
    rows.forEach(row => sheet.addRow(row));

    /* Set response headers for file download */
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=view_logs.xlsx"
    );

    /* Stream workbook directly to response */
    await workbook.xlsx.write(res);
    res.end();

  });

});


/* ============================================================
   DELETE /api/logs/:id
   Deletes a single log entry by its ID.
   ============================================================ */
router.delete("/logs/:id", verifyAdmin, (req, res) => {

  const id = req.params.id;

  db.query(
    "DELETE FROM view_logs WHERE id = ?",
    [id],
    (err) => {
      if (err) return res.json({ success: false });
      res.json({ success: true });
    }
  );

});


/* ============================================================
   POST /api/users/delete-user-logs
   Deletes ALL logs for a specific mobile number.
   Pass mobile = "Unknown" to delete entries with no mobile.
   ============================================================ */
router.post("/users/delete-user-logs", verifyAdmin, (req, res) => {

  const { mobile } = req.body;

  let query, params;

  if (mobile === "Unknown") {
    /* Delete all rows where mobile is null, empty, or literally "Unknown" */
    query  = `DELETE FROM view_logs WHERE mobile IS NULL OR mobile = '' OR mobile = 'Unknown'`;
    params = [];
  } else {
    /* Delete all rows for a specific mobile number */
    query  = "DELETE FROM view_logs WHERE mobile = ?";
    params = [mobile];
  }

  db.query(query, params, (err) => {
    if (err) {
      console.error("Delete user logs error:", err.message);
      return res.json({ success: false });
    }
    res.json({ success: true });
  });

});

module.exports = router;
