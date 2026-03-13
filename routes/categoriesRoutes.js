const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyAdmin = require("../middleware/verifyAdmin");

/* GET categories */
router.get("/", (req, res) => {
  db.query("SELECT * FROM categories", (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

/* ADD category */
router.post("/", verifyAdmin, (req, res) => {
  const { name } = req.body;
    if(!name || name.trim().length < 2){
    return res.status(400).json({error:"Invalid category name"});
    }
  db.query(
    "INSERT INTO categories (name) VALUES (?)",
    [name],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ success: true });
    }
  );
});

/* DELETE category */
router.delete("/:id", verifyAdmin, (req,res)=>{

 const id = req.params.id;

 db.query("SELECT id FROM categories WHERE id=?", [id], (err,rows)=>{

   if(rows.length === 0){
     return res.status(404).json({error:"Category not found"});
   }

   db.query("DELETE FROM categories WHERE id=?", [id], ()=>{
     res.json({success:true});
   });

 });

});

router.put("/:id", verifyAdmin, (req, res) => {
  const { name } = req.body;

  db.query(
    "UPDATE categories SET name=? WHERE id=?",
    [name, req.params.id],
    (err) => {
      if (err) return res.status(500).send(err);
      res.json({ success: true });
    }
  );
});

module.exports = router;
