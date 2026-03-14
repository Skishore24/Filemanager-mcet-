/* ============================================================
   middleware/verifyToken.js
   JWT authentication middleware for general authenticated routes.

   Usage: router.get("/route", verifyToken, handler)

   Verifies the Bearer token is valid. Does NOT enforce role.
   Use verifyAdmin.js when admin role is required.
   ============================================================ */

const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {

  const authHeader = req.headers.authorization;

  /* Ensure Authorization header is present */
  if (!authHeader) {
    return res.status(403).json({ message: "No token provided" });
  }

  /* Extract token from "Bearer <token>" */
  const token = authHeader.split(" ")[1];

  /* Verify and decode the JWT */
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* Attach decoded payload to request for downstream use */
    req.user = decoded;

    next(); /* Proceed to route handler */

  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = verifyToken;