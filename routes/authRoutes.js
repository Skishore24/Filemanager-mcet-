const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

router.post("/login", async (req,res)=>{

  let { email, password } = req.body;

  if(!email || !password || typeof email !== 'string' || typeof password !== 'string'){
    return res.status(400).json({message:"Username/Email and password required and must be text"});
  }

  try{

    /* if user enters username convert to email */
    if(!email.includes("@")){
      email = email + "@gmail.com";
    }

    const [rows] = await db.promise().query(
      "SELECT * FROM users WHERE email=? LIMIT 1",
      [email]
    );

    if(rows.length === 0){
      return res.status(401).json({message:"User not found"});
    }

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password);

    if(!match){
      return res.status(401).json({message:"Wrong password"});
    }

    const token = jwt.sign(
      {
        id:user.id,
        role:user.role,
        email:user.email
      },
      process.env.JWT_SECRET,
      {expiresIn:"2h"}
    );

    res.json({
      token,
      user:{
        email:user.email,
        role:user.role
      }
    });

  }catch(err){
    console.log("Login error:",err);
    res.status(500).json({message:"Server error"});
  }

});

module.exports = router;