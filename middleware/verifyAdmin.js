const jwt = require("jsonwebtoken");

function verifyAdmin(req, res, next) {

  const authHeader = req.headers.authorization;

  // 1️⃣ Check if Authorization header exists
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  // 2️⃣ Check token format: Bearer TOKEN
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Invalid token format" });
  }

 const token = authHeader.split(" ")[1];
    if(!token){
    return res.status(401).json({error:"Token missing"});
    }

  // 3️⃣ Verify token
  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4️⃣ Check admin role
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    // 5️⃣ Attach user to request
    req.user = decoded;

    next();

  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }

}

module.exports = verifyAdmin;