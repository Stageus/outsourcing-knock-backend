const express = require("express");
const router = express.Router();
const userAccount = require("../middlewares/userAccount");
const terms = require("../middlewares/terms");
const banner = require('../middlewares/banner')
const expert = require('../middlewares/expert');
const jwtToken = require('../middlewares/jwtToken');
const toss = require('../middlewares/toss');
const admin = require('../middlewares/admin');

//dev_Lee
router.get('/test/reviews/:pageCount', userAccount.getTestReview);
router.get('/users/:userid/service-usage-histories', jwtToken.verifyToken, userAccount.getServiceUsageHistories);
router.delete('/users/:userid/reviews',jwtToken.verifyAdminToken, admin.deleteUserReview);
router.get('/users/:userid/reviews', jwtToken.verifyAdminToken, admin.getUserReviewList);
router.head('/users/:email', admin.checkDuplicatedEmail);
//dev_Lee
router.route('/users/:userid/email-authentication')
        .post(jwtToken.verifyToken, userAccount.sendAuthenticationEmail)
        .get(userAccount.authenticateUserEmail);
router.route('/users/:userid/favorites')
    // dev_Lee
    .get(jwtToken.verifyToken, userAccount.getFavoriteExpert)
    //
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
router.get('/experts/:expertId/register', expert.getRegisterInfo);
router.post('/experts/:expertId/register', expert.register);
router.post('/experts/password-reminder', expert.resetPassword);
router.get('/safety-number/:phone_number', expert.issueSafetyNumber);
router.get('/experts/:expertId/profile', expert.getProfile);
router.post('/experts/:expertId/profile', expert.updateProfile);

//

// dev_Lee
router.get('/experts/types/:firstcategory/:secondcategory/:thirdcategory/:pagecount', expert.getExpertsList);
router.get('/experts/:expertid', expert.getExpertDetail);
router.post('/kakao', userAccount.kakaoLogin);
router.post('/google', userAccount.googleLogin);
router.post('/payment-form',toss.getPaymentForm);
router.get('/payment-success',toss.approvalCardPayment);
router.post('/webhook',toss.getWebhook);
router.get('/images/banners/:fileName', banner.getBannerimage);
router.get('/images/expert/profile/:fileName', expert.getProfileImage);
router.post('/superadmin-signin', admin.login);
router.post('/searching-user/:pageCount', jwtToken.verifyAdminToken, admin.searchUser);
router.post('/searching-expert', jwtToken.verifyAdminToken, admin.searchExpert);
router.put('/users/:userid/blocking-status', jwtToken.verifyAdminToken, admin.modifyUserBlockingStatus);
router.post('/superadmin-signup', userAccount.createAccount);
router.post('/searching-counseling',jwtToken.verifyAdminToken, admin.searchCounseling);
//

module.exports = router;
