require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

/* ================= SECURITY ================= */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com"
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://fonts.googleapis.com"
        ],

        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://cdn.jsdelivr.net"
        ],

        connectSrc:["'self'"],

        workerSrc: [
          "'self'",
          "blob:"
        ]
      }
    }
  })
);
app.disable("x-powered-by");
app.use(cors());

/* ================= RATE LIMIT ================= */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/send-otp", limiter);
app.use("/api/verify-otp", limiter);
app.use("/secure-files", limiter);
app.use((req,res,next)=>{
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("X-Frame-Options","SAMEORIGIN");
 next();
});
/* ================= MIDDLEWARE ================= */

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({ extended: true, limit:"2mb" }));

/* ================= STATIC FILES ================= */

app.use(express.static(path.join(__dirname, "public")));

/* ================= ROUTES ================= */

const otpRoutes = require("./routes/otpRoutes");
const fileRoutes = require("./routes/fileRoutes");
const categoriesRoutes = require("./routes/categoriesRoutes");
const logRoutes = require("./routes/logRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const protectedFiles = require("./routes/protectedFiles");
const authRoutes = require("./routes/authRoutes");

app.use("/api", otpRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api", logRoutes);
app.use("/api/users", userRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/auth", authRoutes);

/* ================= SECURE FILE ROUTE ================= */

app.use("/secure-files", protectedFiles);

/* ================= START SERVER ================= */
app.use((err,req,res,next)=>{
 console.error(err);
 res.status(500).json({error:"Server error"});
});
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});