const express = require("express");
const router = express.Router();
const twilio = require("twilio");
require("dotenv").config();

let otpStore = {};
let otpAttempts = {};

/* TWILIO SETUP */
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* SEND OTP */
router.post("/send-otp", async (req, res) => {

  const { mobile } = req.body;
  if(!mobile || mobile.length < 10){
 return res.json({success:false,message:"Invalid mobile number"});
}
if(otpStore[mobile] && Date.now() < otpStore[mobile].expires){
 return res.json({success:false,message:"OTP already sent"});
}
  const otp = Math.floor(1000 + Math.random() * 9000);

otpStore[mobile] = {
 otp,
 expires: Date.now() + 5 * 60 * 1000
};

setTimeout(()=>{
 delete otpStore[mobile];
},5*60*1000);

  try {

    await client.messages.create({
      body: `Your OTP is ${otp}`,
      from: "whatsapp:+14155238886",
      to: `whatsapp:${mobile}`
    });

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.json({ success: false });
  }

});

/* VERIFY OTP */
router.post("/verify-otp", (req, res) => {

  const { mobile, otp } = req.body;

  if(!otpAttempts[mobile]) otpAttempts[mobile] = 0;

  otpAttempts[mobile]++;

  if(otpAttempts[mobile] > 5){
    return res.status(429).json({ success:false, message:"Too many attempts" });
  }

  if(!otpStore[mobile]){
    return res.json({ success:false, message:"OTP not found" });
  }

  if(Date.now() > otpStore[mobile].expires){
 delete otpStore[mobile];
 otpAttempts[mobile] = 0;
 return res.json({ success:false, message:"OTP expired" });
}

  if(String(otpStore[mobile].otp) === String(otp)){

    delete otpStore[mobile];
    otpAttempts[mobile] = 0;

    return res.json({ success:true });
  }

  res.json({ success:false });

});

module.exports = router;