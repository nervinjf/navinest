const { Router } = require("express");
const { userLogin, resetEmail, forgotPassword, validateTokenReset} = require("../controllers");
const cors = require("cors");


const router = Router();

router.post("/nebconnection/nestle/auth/login",  cors({origin: "*"}),userLogin);
router.get("/nebconnection/nestle/auth/reset/email",  cors({origin: "*"}),validateTokenReset);
router.post("/nebconnection/nestle/auth/reset/email",  cors({origin: "*"}),resetEmail);
router.post("/nebconnection/nestle/auth/forgot-password",  cors({origin: "*"}), forgotPassword);

module.exports = router;
