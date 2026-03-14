const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyAdmin = require("../middleware/verifyAdmin");

/* CHECK BLOCK */
router.post("/check-block", (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ error: "Mobile number is required" });

  db.query(
    "SELECT * FROM blocked_users WHERE mobile=?",
    [mobile],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });

      res.json({ blocked: result.length > 0 });
    }
  );
});
router.post("/offline",(req,res)=>{

  const { mobile } = req.body;

  if(!mobile) return res.json({success:false});

  db.query(`
    UPDATE view_logs
    SET last_active = DATE_SUB(NOW(), INTERVAL 1 MINUTE)
    WHERE id = (
      SELECT id FROM (
        SELECT id
        FROM view_logs
        WHERE mobile = ?
        ORDER BY viewed_at DESC
        LIMIT 1
      ) AS t
    )
  `,[mobile],()=>res.json({success:true}));

});
/* BLOCK USER */
router.post("/block", verifyAdmin,(req,res)=>{

  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ success: false, error: "Mobile number is required" });

  db.query(
    "INSERT IGNORE INTO blocked_users (mobile) VALUES (?)",
    [mobile],
    (err)=>{
      if(err) return res.json({success:false});
      res.json({success:true});
    }
  );
});
router.get("/blocked", verifyAdmin,(req,res)=>{
  db.query("SELECT mobile FROM blocked_users",(err,result)=>{
    if(err) return res.status(500).json({error:"DB error"});
    res.json(result);
  });
});
router.post("/heartbeat", (req, res) => {
  const { mobile } = req.body;

  if (!mobile) return res.json({ success:false });

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
      if(err){
        console.log(err);
        return res.json({ success:false });
      }
      res.json({ success:true });
    }
  );
});


/* UNBLOCK USER */
router.post("/unblock", verifyAdmin,(req,res)=>{
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ success: false, error: "Mobile number is required" });

  db.query(
    "DELETE FROM blocked_users WHERE mobile=?",
    [mobile],
    err => {
      if (err) return res.status(500).json({ error: err });

      res.json({ success: true });
    }
  );
});

module.exports = router;
