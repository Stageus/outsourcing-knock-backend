const express = require("express");
const router = express.Router();
const userAccount = require("../middlewares/userAccount");
const terms = require("../middlewares/terms");
const banner = require('../middlewares/banner')
const expert = require('../middlewares/expert');
const jwtToken = require('../middlewares/jwtToken');

router.get('/users/:userid/alarms', jwtToken.verifyToken, userAccount.getAlarmList);
router.post('/userLogin', userAccount.login);
router.post('/signup', userAccount.createAccount);
router.post('/signin', userAccount.login);
router.post('/password-reminder', userAccount.resetPassword);

router.route('/terms')
    .get(terms.getTerms)
    .post(terms.agreeTerms);

router.get('/banners/:bannerid', banner.getBannerDetail);
router.get('/banners', banner.getBannerList);

router.get('/recommendation-experts', expert.getRecommendedExpertsList);
router.post('/experts/signup', expert.createAccount);
router.post('/experts/signin', expert.login);
router.get('/experts/:expertId/register', expert.getRegisterInfo);
router.post('/experts/:expertId/register', expert.register);
router.post('/experts/password-reminder', expert.resetPassword);

module.exports = router;