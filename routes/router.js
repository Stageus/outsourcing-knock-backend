const express = require("express");
const router = express.Router();
const userAccount = require("../middlewares/userAccount");
const jwtToken = require("../utils/jwtToken");

router.post("/userLogin", userAccount.login);
router.post('/signup', userAccount.createAccount);

module.exports = router;