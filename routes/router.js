const express = require("express");
const router = express.Router();
const account = require("../middlewares/account");

router.post("/login", account.login);

module.exports = router;