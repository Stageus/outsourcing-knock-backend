const express = require("express");
const router = express.Router();
const userAccount = require("../middlewares/userAccount");
const terms = require("../middlewares/terms");
const banner = require('../middlewares/banner')
const expert = require('../middlewares/expert');
const jwtToken = require('../middlewares/jwtToken');

router.route('/users/:userid/email-authentication')
        .post(jwtToken.verifyToken, userAccount.sendAuthenticationEmail)
        .get(userAccount.authenticateUserEmail);
router.route('/users/:userid/favorites')
    .post(jwtToken.verifyToken, userAccount.addFavoriteExpert)
    .delete(jwtToken.verifyToken, userAccount.deleteFavoriteExpert);
router.get('/users/:userid/alarms', jwtToken.verifyToken, userAccount.getAlarmList);
router.route('/users/:userid')
    .get(jwtToken.verifyToken, userAccount.getUserInformation)
    .put(jwtToken.verifyToken, userAccount.modifyUserInformation)
    .delete(jwtToken.verifyToken, userAccount.deleteUserInformation);
router.post('/userLogin', userAccount.login);
router.post('/signup', userAccount.createAccount);
router.post('/signin', userAccount.login);
router.post('/password-reminder', userAccount.resetPassword);

router.route('/terms')
    .get(terms.getTerms)
    .post(terms.agreeTerms);

router.get('/banners/:bannerid', banner.getBannerDetail);
router.get('/banners', banner.getBannerList);

// dev_shin
router.get('/recommendation-experts', expert.getRecommendedExpertsList);
router.post('/experts/signup', expert.createAccount);
router.post('/experts/signin', expert.login);
router.route('/experts/:expertId/register')
    .get(expert.getRegisterInfo)
    .post(expert.register);
router.post('/experts/password-reminder', expert.resetPassword);
router.get('/safety-number/:phone_number', expert.issueSafetyNumber);
router.route('/experts/:expertId/profile')
    .get(expert.getProfile)
    .post(expert.updateProfile);
router.route('/experts/:expertId/info')
    .get(expert.getExpertInfo)
    .post(expert.updateExpertInfo);
router.get('/experts/:expertId/phone-validation/:phone', expert.phoneValidation);
router.get('/experts/counseling/count', expert.getTotalCounseling);
router.get('/experts/:expertId/counseling/:searchType/:description/:progress/:counselingType/:startDate/:endDate/:pagecount', expert.getCounselingList);
router.route('/experts/:expertId/counseling/:productId')
    .get(expert.getCounseling)
    .post(expert.updateCounseling);
router.get('/experts/:expertId/counseling/:productId/prequestion', expert.getPrequestion);
router.get('/experts/:expertId/counseling/:productId/review', expert.getReview);
router.post('/experts/:expertId/counseling/:productId/join-room', expert.joinChatRoom);
router.post('/experts/:expertId/counseling/:productId/time', expert.setCounselingDate);
router.post('/experts/counseling/:productId/begin', expert.beginCounseling);
router.post('/experts/counseling/:productId/end', expert.endCounseling);
router.post('/experts/counseling/:productId/cancel', expert.cancelCounseling);
//

// dev_Lee
router.get('/experts/types/:firstcategory/:secondcategory/:thirdcategory/:pagecount', expert.getExpertsList);
router.get('/experts/:expertid', expert.getExpertDetail);

//

module.exports = router;