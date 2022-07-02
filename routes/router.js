const express = require("express");
const router = express.Router();
const account = require("../middlewares/account");
const jwtToken = require("../utils/jwtToken");

router.post("/login", account.login);
router.get("/tokenLogin", account.tokenLogin);

module.exports = router;