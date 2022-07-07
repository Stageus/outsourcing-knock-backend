const express = require("express");
const router = express.Router();
const userAccount = require("../middlewares/userAccount");
const terms = require("../middlewares/terms");
const jwtToken = require("../utils/jwtToken");

router.post("/userLogin", userAccount.login);
router.post('/signup', userAccount.createAccount);
router.route('/terms')
    .get(terms.getTerms)
    .post(terms.agreeTerms);
router.post('/signin', userAccount.login);


module.exports = router;