const { Router } = require("express");
const { userRegister, getAllUsers, verifyOTP,updateUserRoleAndStatus } = require("../controllers");
const { authVerification, requireAdmin } = require("../middlewares/auth.middleware");


const router = Router();

router.get("/nebconnection/nestle/users",  authVerification, getAllUsers);
router.post('/nebconnection/nestle/users', userRegister);
router.post('/verifyOTP', verifyOTP);
// PATCH: actualizar rol y estado activo de un usuario
router.patch("/nebconnection/nestle/users/:id", authVerification, requireAdmin, updateUserRoleAndStatus);


module.exports = router;
