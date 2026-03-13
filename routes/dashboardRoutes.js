const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyAdmin = require("../middleware/verifyAdmin");

/* ================= DASHBOARD STATS ================= */

router.get("/dashboard", verifyAdmin, async (req, res) => {
  try {

    const [files] = await db.promise().query(
      "SELECT COUNT(*) AS totalFiles FROM files"
    );

    const [views] = await db.promise().query(
      "SELECT COUNT(*) AS totalViews FROM view_logs"
    );

    const [categories] = await db.promise().query(
      "SELECT COUNT(*) AS totalCategories FROM categories"
    );

    // FIXED ACTIVE USERS QUERY
    const [users] = await db.promise().query(`
      SELECT COUNT(DISTINCT mobile) AS totalUsers
      FROM view_logs
      WHERE last_active >= NOW() - INTERVAL 30 SECOND
      AND mobile IS NOT NULL
      AND mobile <> ''
    `);

    const [topFile] = await db.promise().query(`
      SELECT file_name, COUNT(*) as total
      FROM view_logs
      GROUP BY file_name
      ORDER BY total DESC
      LIMIT 1
    `);

    res.json({
      totalFiles: files?.[0]?.totalFiles || 0,
      totalViews: views?.[0]?.totalViews || 0,
      totalCategories: categories?.[0]?.totalCategories || 0,
      totalUsers: users?.[0]?.totalUsers || 0,
      topFile: topFile.length ? topFile[0].file_name : "None"
    });

  } catch (err) {
    console.log("Dashboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});



/* ================= DASHBOARD CHARTS ================= */

router.get("/dashboard/charts", verifyAdmin, async (req, res) => {
  try {

    const [performance] = await db.promise().query(`
      SELECT 
        DATE_FORMAT(viewed_at,'%b') AS month,
        COUNT(*) AS views,
        SUM(CASE WHEN action='download' THEN 1 ELSE 0 END) AS downloads
      FROM view_logs
      WHERE viewed_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY YEAR(viewed_at), MONTH(viewed_at), DATE_FORMAT(viewed_at,'%b')
      ORDER BY YEAR(viewed_at), MONTH(viewed_at)
    `);

    const [devices] = await db.promise().query(`
      SELECT 
        CASE 
          WHEN device REGEXP 'Android|iPhone|iPad' THEN 'Mobile'
          WHEN device REGEXP 'Windows|Mac|Linux' THEN 'Desktop'
          ELSE 'Other'
        END AS device,
        COUNT(*) AS total
      FROM view_logs
      GROUP BY device
    `);

    const [countries] = await db.promise().query(`
      SELECT 
        country,
        COUNT(*) AS views,
        SUM(CASE WHEN action='download' THEN 1 ELSE 0 END) AS downloads
      FROM view_logs
      WHERE country IS NOT NULL 
      AND country <> '' 
      AND country <> 'Unknown'
      GROUP BY country
      ORDER BY views DESC
      LIMIT 10
    `);

    const [topUsers] = await db.promise().query(`
      SELECT 
        COALESCE(name,'Unknown') AS name,
        mobile,
        COUNT(*) AS totalVisits,
        MAX(last_active) AS lastActive
      FROM view_logs
      WHERE mobile IS NOT NULL 
      AND mobile <> ''
      GROUP BY mobile, name
      ORDER BY totalVisits DESC
      LIMIT 5
    `);

    const [views] = await db.promise().query(`
      SELECT 
        DATE_FORMAT(MIN(viewed_at),'%b') AS month,
        COUNT(DISTINCT mobile) AS total,
        YEAR(viewed_at) AS y,
        MONTH(viewed_at) AS m
      FROM view_logs
      WHERE viewed_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      AND mobile IS NOT NULL
      AND mobile <> ''
      GROUP BY YEAR(viewed_at), MONTH(viewed_at)
      ORDER BY YEAR(viewed_at), MONTH(viewed_at)
    `);

    res.json({
      performance,
      devices,
      countries,
      topUsers,
      views
    });

  } catch (err) {
    console.log("Chart error:", err);
    res.status(500).json({ error: "Chart error" });
  }
});

module.exports = router;