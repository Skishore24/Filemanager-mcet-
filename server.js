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
          "https://unpkg.com",
          "https://cdnjs.cloudflare.com"
        ],

        scriptSrcAttr: [
          "'self'",
          "'unsafe-inline'"
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com"
        ],

        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "data:"
        ],

        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
          "https://cdnjs.cloudflare.com",
          "https://flagcdn.com",
          "https://*.googleusercontent.com"
        ],

        connectSrc: [
  "'self'",
  "https://cdn.jsdelivr.net",
  "https://unpkg.com",
  "https://cdnjs.cloudflare.com",
  "https://ipwho.is/"
],

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
app.set("trust proxy", 1);

/* ================= RATE LIMIT ================= */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/send-otp", limiter);
app.use("/api/verify-otp", limiter);
app.use("/secure-files", rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50
}));
app.use((req,res,next)=>{
  res.setHeader("Referrer-Policy","no-referrer");
  next();
});
/* ================= MIDDLEWARE ================= */

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({ extended: true, limit:"2mb" }));
app.use("/api/auth/login", rateLimit({
 windowMs: 15 * 60 * 1000,
 max: 10
}));

/* ================= STATIC FILES ================= */

app.use(express.static(path.join(__dirname, "public"),{
  maxAge:"1d",
  etag:true
}));

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