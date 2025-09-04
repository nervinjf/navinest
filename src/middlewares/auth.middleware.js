const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticate = (req, res, next) => {
  const bearerToken = req.headers.authorization; // "Bearer <token>"

  if (!bearerToken) {
    return res.status(401).json({ message: "Falta token de autorización" });
  }

  const token = bearerToken.replace("Bearer ", "").trim();

  try {
    const decoded = jwt.verify(token, process.env.SECRET, {
      algorithms: ["HS512"], // 👈 aseguras que coincida con el que usaste al firmar
    });

    // Inyectar en req
    req.user = decoded;   // ahora tendrás { id, rol, email, ... }
    req.userId = decoded.id;

    next();
  } catch (error) {
    console.error("❌ Error verificando token:", error.message);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
};

module.exports = authenticate;
