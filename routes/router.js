const express = require("express");
const router = express.Router();
const userAccount = require("../middlewares/userAccount");
const terms = require("../middlewares/terms");
const banner = require('../middlewares/banner')
const expert = require('../middlewares/expert');
const jwtToken = require('../middlewares/jwtToken');
const counselingList = require('../middlewares/counselingList');
const testList = require('../middlewares/testList');
const chat = require('../middlewares/chat');
const calculate = require('../middlewares/calculate');
const toss = require('../middlewares/toss');
const admin = require('../middlewares/admin');
const image = require('../middlewares/image');
const phone = require('../middlewares/phoneValidation');
const push = require('../middlewares/push');

//dev_Lee
router.get('/superadmin-settlement-of-month',admin.getSettlementOfMonthList);
router.get('/superadmin-cancelpayment/:paymentKey', admin.getCancelPaymentDetail);
router.get('/superadmin-cancelpayment', admin.getCancelPaymentList);
router.get('/superadmin-payment/:paymentKey',jwtToken.verifyAdminToken, admin.getPaymentDetail);
router.delete('/superadmin-payment/:paymentKey', admin.cancelPayment);
router.post('/users/:userId/affiliate', userAccount.authenticateAffiliate);
router.get('/test/reviews/:pageCount', userAccount.getTestReview);
router.get('/users/:userid/service-usage-histories/:paymentKey', userAccount.getServiceUsageHistoriesDetail);
router.get('/users/:userid/service-usage-histories', jwtToken.verifyToken, userAccount.getServiceUsageHistories);
router.get('/users/:userid/reviews/:reviewid', jwtToken.verifyAdminToken, admin.getUserReview);
router.delete('/users/:userid/reviews',jwtToken.verifyAdminToken, admin.deleteUserReview);
router.get('/users/:userid/reviews', jwtToken.verifyAdminToken, admin.getUserReviewList);
router.get('/users/:userId/coupons/:productType', userAccount.getAvailableCouponList);
router.get('/users/:userId/coupons', jwtToken.verifyToken, userAccount.getCouponList);
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
router.get('/users/:userid/alarms/:pageCount', jwtToken.verifyToken, userAccount.getAlarmList);
router.head('/users/:userid/alarms', userAccount.isThereUnconfirmedAlarm);
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
    .post(terms.agreeTerms)
    .put(admin.modifyTerms);

router.get('/banners/:bannerid', banner.getBannerDetail);
router.route('/banners')
        .get(banner.getBannerList)
        .post(jwtToken.verifyAdminToken, image.uploadBannerImage)

// dev_shin
router.get('/recommendation-experts', expert.getRecommendedExpertsList);
router.route('/experts/signin')
    .post(expert.login)
    .get(jwtToken.verifyExpertTokenLogin, expert.tokenLogin);
router.post('/experts/signup', expert.createAccount);
router.route('/experts/:expertId/register')
    .get(expert.getRegisterInfo)
    .post(expert.register);
router.post('/experts/:expertId/password-reminder', jwtToken.verifyExpertToken, expert.resetPassword);
router.get('/experts/:expertId/safety-number/:phone_number', expert.issueSafetyNumber);
router.route('/experts/:expertId/profile')
    .get(expert.getProfile)
    .post(expert.updateProfile);
router.route('/experts/:expertId/info')
    .get(expert.getExpertInfo)
    .post(expert.updateExpertInfo);
router.get('/phone-validation/:phone', phone.sendCertifiedNumber);
router.post('/phone-validation/:phone', phone.phoneValidation);
router.put('/push/:userid', push.registerDeviceToken);
router.post('/push/:userid', push.pushAlarm);
router.get('/push/:userid', push.getToken);

router.get('/experts/test/counseling/:productId/review', testList.getReview);

router.get('/experts/:expertId/counseling/:searchType/:description/:progress/:counselingTypeChatting/:counselingTypeVoice/:startDate/:endDate', counselingList.getCounselingList);
router.get('/experts/counseling/:productId', counselingList.getCounseling);
router.post('/experts/:expertId/counseling/:productId', counselingList.updateCounseling);
router.get('/experts/counseling/:productId/prequestion', counselingList.getPrequestion);
router.get('/experts/:expertId/counseling/:productId/review', counselingList.getReview);
router.post('/experts/:expertId/counseling/:productId/join-room', counselingList.joinChatRoom);
router.post('/experts/:expertId/counseling/:productId/time', counselingList.setCounselingDate);
router.put('/experts/:expertId/counseling/:productId/time', counselingList.updateCounselingDate);
router.post('/experts/counseling/:productId/begin', counselingList.beginCounseling);
router.post('/experts/counseling/:productId/end', counselingList.endCounseling);
router.post('/experts/counseling/:productId/cancel', counselingList.cancelCounseling);


router.get('/experts/test/allot', testList.getAllocationList);
router.get('/experts/test/allot/:productIndex/view-result', testList.viewResult);
router.post('/experts/:expertId/test/allocate', testList.allot);
router.get('/experts/:expertId/test/counseling/:searchType/:description/:progress/:cancelStatus/:startDate/:endDate', testList.getCounselingList);
router.post('/experts/test/counseling/:productId/result-open', testList.openCounselingResult);
router.route('/experts/test/counseling/:productId')
    .get(testList.getCounseling)
    .delete(testList.cancelCounseling)
    .put(testList.updateCounseling);


router.get('/experts/:expertId/chat', chat.getChatRoomList);
router.get('/experts/chat/:roomId', chat.getChattingList);
router.get('/experts/chat/:roomId/counseling', chat.getProgressingList);
router.route('/experts/:expertId/chat/macro')
    .get(chat.getMacro)
    .post(chat.updateMacro);


router.get('/experts/:expertId/settlement', calculate.getCalculationDetail);
router.put('/experts/:expertId/settlement', calculate.updateAccount);
//

// dev_Lee
router.route('/superadmin/users/:userid')
        .get(jwtToken.verifyAdminToken, userAccount.getUserInformation)
        .put(jwtToken.verifyAdminToken, admin.modifyUserInformation);
router.get('/experts/types/:firstcategory/:secondcategory/:thirdcategory/:pagecount', expert.getExpertsList);
router.get('/experts/:expertid/reviews/:pagecount', expert.getReviewList);
router.get('/experts/:expertid/best-reviews', expert.getBestReview);
router.get('/experts/:expertid', expert.getExpertDetail);
router.post('/kakao', userAccount.kakaoLogin);
router.post('/google', userAccount.googleLogin);
router.get('/payment/:paymentKey', userAccount.getPaymentDetail);
router.get('/payment-form',toss.getPaymentForm);
router.get('/payment-success',toss.approvalCardPayment);
router.post('/webhook',toss.getWebhook);
router.get('/images/banners/:fileName', banner.getBannerimage);
router.get('/images/expert/profile/:fileName', expert.getProfileImage);
router.post('/superadmin-signin', admin.login);
router.post('/searching-user', jwtToken.verifyAdminToken, admin.searchUser);
router.post('/searching-expert', jwtToken.verifyAdminToken, admin.searchExpert);
router.put('/users/:userid/blocking-status', jwtToken.verifyAdminToken, admin.modifyUserBlockingStatus);
router.post('/superadmin-signup', userAccount.createAccount);
router.post('/searching-counseling',jwtToken.verifyAdminToken, admin.searchCounseling);
router.post('/searching-test', jwtToken.verifyAdminToken, admin.searchTest);
router.post('/searching-banner', jwtToken.verifyAdminToken, admin.searchBannerList);
router.post('/searching-coupon', admin.searchCouponList);


router.get('/experts', jwtToken.verifyAdminToken, admin.getAllExpertList);
router.get('/users', jwtToken.verifyAdminToken, admin.getAllUserList);
router.get('/counselings', jwtToken.verifyAdminToken, admin.getAllcounselingList);
router.get('/tests', jwtToken.verifyAdminToken, admin.getAllTestList);
router.get('/superadmin-banners/:bannerId', jwtToken.verifyAdminToken, admin.getBannerDetail);
router.get('/superadmin-banners', jwtToken.verifyAdminToken, admin.getAllBannerList);
router.get('/superadmin-payment', jwtToken.verifyAdminToken, admin.getAllPaymentList);
router.route('/superadmin-review/:reviewId')
        .get(jwtToken.verifyAdminToken ,admin.getReviewDetail)
        .put(jwtToken.verifyAdminToken, admin.modifyReview);
router.get('/superadmin-review', jwtToken.verifyAdminToken, admin.getAllReviewList);
router.put('/superadmin-coupon/:couponId', jwtToken.verifyAdminToken, admin.modifyCoupon);
router.get('/superadmin-coupon/:couponId',jwtToken.verifyAdminToken, admin.getCouponDetail);
router.get('/superadmin-coupon', jwtToken.verifyAdminToken, admin.getAllCouponList);
router.post('/superadmin-coupon', jwtToken.verifyAdminToken, admin.createNormalCoupon);
router.post('/superadmin-affiliate/:affiliateId/code', jwtToken.verifyAdminToken,admin.createAffiliateCode);
router.get('/superadmin-affiliate/:affiliateId/code', jwtToken.verifyAdminToken, admin.getAffiliateCodeList);
router.get('/superadmin-affiliate/:affiliateId/coupon', jwtToken.verifyAdminToken, admin.getAffiliateCouponList);
router.post('/superadmin-affiliate/:affiliateId/coupon', jwtToken.verifyAdminToken, admin.createAffiliateCoupon);
router.get('/superadmin-affiliate/:affiliateId', jwtToken.verifyAdminToken, admin.getAffiliateDetail);
router.put('/superadmin-affiliate/:affiliateId', jwtToken.verifyAdminToken, admin.modifyAffiliate);
router.get('/superadmin-affiliate' ,jwtToken.verifyAdminToken, admin.getAffiliateList);
router.post('/superadmin-affiliate', jwtToken.verifyAdminToken, admin.createAffiliate);
router.post('/review', jwtToken.verifyToken, userAccount.createReview);
router.head('/affiliate/:code', userAccount.isVaildAffiliateCode);
router.post('/payments/:paymentKey/pre-question-answer', userAccount.answerPreQuestion);
//

module.exports = router;