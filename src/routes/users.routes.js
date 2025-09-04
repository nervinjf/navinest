const { Router } = require("express");
const { userRegister, getAllUsers, verifyOTP } = require("../controllers");
const authVerification = require("../middlewares/auth.middleware");


const router = Router();

router.get("/nebconnection/nestle/users",  authVerification, getAllUsers);
router.post('/nebconnection/nestle/users', userRegister);
router.post('/verifyOTP', verifyOTP);

module.exports = router;