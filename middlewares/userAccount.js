const jwtToken = require('../utils/jwtToken');
const { MongoConnectionError } = require("../errors/error");
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, TokenIssueError, SendMailError} = require('../errors/error');
const parameter = require('../utils/parameter');
const postgres = require("../database/pg");
const mongodb = require("../database/MongoDB");
const mailer = require('../utils/email');
const hasing = require('../utils/password');

module.exports.login = async(req, res)=>{
    
    const email = req.body.email;
    const password = req.body.password;
    const pg = new postgres();
    try{
        await parameter.nullCheck(email, password);
        const hashedPassword = await hasing.createHashedPassword(password);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT user_index AS user_id, is_left, is_blocked FROM knock.users WHERE id = $1 AND password = $2;
            `
        ,[email, hashedPassword]);
        if(result.rowCount == 0)       // id, password 쌍이 존재하지 않을 경우
            return res.status(401).send();
        else if(result.rows[0].is_blocked == true || result.rows[0].is_left == true)  // 차단됐거나 탈퇴한 사용자일 경우
            return res.status(403).send();
        
        const token = await jwtToken.issueToken(result.rows[0].user_id); // 인증된 사용자라면 유저 index값을 넣어 토큰을 만들어준다.

        return res.status(200).send({
            user_id : result.rows[0].user_id,
            token : token
        })

    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
    
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        if(err instanceof TokenIssueError)
            return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }

};

module.exports.createAccount = async(req, res)=>{
    const email = req.body.email;
    const password = req.body.password;
    const nickname = req.body.nickname;
    const pg = new postgres();

    try{
        await parameter.nullCheck(email, password, nickname);
        const hashedPassword = await hasing.createHashedPassword(password);
        await pg.connect();
        await pg.queryUpdate(
        `
        INSERT INTO knock.users (id, password, nickname, platform) VALUES($1, $2, $3, 'knock');
        `,
        [email, hashedPassword, nickname]);
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(409).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.resetPassword = async(req,res) =>{
    const email = req.body.email;
    const pg = new postgres();

    try{
        await parameter.nullCheck(email);
        const tmpPassword = Math.random().toString(36).substring(2,11);
        const hashedPassword =  await hasing.createHashedPassword(tmpPassword);
        console.log(tmpPassword);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users SET password = $1 WHERE id = $2;
            `
        ,[hashedPassword, email])
        
        await mailer.sendMail(tmpPassword, email);
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
    
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(409).send();

        if(err instanceof SendMailError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}


module.exports.getAlarmList = async(req,res) =>{
    const userId = req.params.userid;
    const pageCount = (req.params.pageCount-1) * 20;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId, pageCount);
        await pg.connect();
        const result = await pg.queryExecute(
        `
        SELECT alarm_index AS alarm_id, title, content, created_at, is_checked FROM knock.alarm 
        WHERE user_index = $1
        ORDER BY created_at
        LIMIT 20 OFFSET $2;
        `,
        [userId, pageCount]);
        if(result.rowCount != 0){
            await pg.queryUpdate(   // 확인한 알람들의 is_checked를 true로 set합니다.
                `
                UPDATE knock.alarm SET is_checked = true 
                WHERE user_index IN (
                    SELECT user_index
                    FROM knock.alarm
                    WHERE user_index = $1 AND is_checked = false AND alarm_index <= $2
                );
                `
            ,[userId, result.rows[0].alarm_id]);
        }
        return res.status(200).send({
            alarmList : result.rows
        });
    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }   
}

module.exports.addFavoriteExpert = async(req, res) =>{
    const pg = new postgres();
    const userId = req.params.userid;
    const expertId = req.body.expertId;
    
    try{
        await parameter.nullCheck(userId, expertId);
        await pg.connect();
        await pg.queryExecute(
            `
            INSERT INTO knock.favorite_expert (user_index, expert_index)
            VALUES($1, $2);
            `
        ,[userId, expertId]);
        
        return res.status(200).send();
    }
    catch(err){

        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
        }
    finally{
        pg.disconnect();
    }
}

module.exports.deleteFavoriteExpert = async(req, res) =>{
    const pg = new postgres();
    const userId = req.params.userid;
    const expertId = req.body.expertId;
    
    try{
        await parameter.nullCheck(userId, expertId);
        await pg.connect();
        await pg.queryExecute(
            `
            DELETE FROM knock.favorite_expert WHERE user_index = $1 AND expert_index = $2;
            `
        ,[userId, expertId]);
        
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
        }
    finally{
        pg.disconnect();
    }
}

module.exports.getUserInformation = async(req,res) =>{
    const pg = new postgres();
    const userId = req.params.userid;

    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT id AS email, nickname, email_certification AS is_email_certified, affiliate, is_left, is_blocked FROM knock.users WHERE user_index = $1;
            `
        ,[userId]);

        return res.status(200).send(result.rows[0]);
    }
    catch(err){
        
        if(err instanceof NullParameterError)
            return res.status(400).send();
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.sendAuthenticationEmail = async(req,res) =>{
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT id AS email FROM knock.users WHERE user_index = $1;
            `
        ,[userId])
        await mailer.sendAuthenticationMail(userId, result.rows[0].email);
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        if(err instanceof SendMailError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.authenticateUserEmail = async(req,res) =>{
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users SET email_certification = true WHERE user_index = $1;
            `
        ,[userId])
        return res.status(200).send("<script>window.close();</script >");
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.modifyUserInformation = async(req, res) =>{
    const userId = req.params.userid;
    const password = req.body.password;
    const nickname = req.body.nickname;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId, password, nickname);
        const hashedPassword = await hasing.createHashedPassword(password);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users SET password = $1, nickname =$2 WHERE user_index = $3;
            `
        ,[hashedPassword, nickname, userId]);
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}


module.exports.deleteUserInformation = async(req,res) =>{
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users SET is_left = true WHERE user_index = $1;
            `
        ,[userId])
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.kakaoLogin = async(req, res) =>{
    const pg = new postgres();
    const email = req.body.email;
    const identifier = req.body.user_number;
    const nickname = "knock_"+Math.random().toString(36).substring(2,6);

    try{
        await parameter.nullCheck(email, identifier,nickname);
        await pg.connect();
        await pg.queryUpdate(
            `
            INSERT INTO knock.users (id, nickname, platform, sns_identifier) 
            VALUES($1, $2, 'kakao', $3)
            ON CONFLICT DO NOTHING;
            `
        ,[email, nickname, identifier]);
        
        const result = await pg.queryExecute(
            `
            SELECT user_index FROM knock.users WHERE id = $1;
            `
        ,[email]);
        const token = await jwtToken.issueToken(result.rows[0].user_index);
        return res.status(200).send({
            user_id : result.rows[0].user_index,
            token : token
        });
    }
    catch(err){

        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        if(err instanceof TokenIssueError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.googleLogin = async(req, res) =>{
    const pg = new postgres();
    const email = req.body.email;
    const identifier = req.body.user_number;
    const nickname = "knock_"+Math.random().toString(36).substring(2,6);

    try{
        await parameter.nullCheck(email, identifier,nickname);
        await pg.connect();
        await pg.queryUpdate(
            `
            INSERT INTO knock.users (id, nickname, platform, sns_identifier) 
            VALUES($1, $2, 'google', $3)
            ON CONFLICT DO NOTHING;
            `
        ,[email, nickname, identifier]);
        
        const result = await pg.queryExecute(
            `
            SELECT user_index FROM knock.users WHERE id = $1;
            `
        ,[email]);
        const token = await jwtToken.issueToken(result.rows[0].user_index);
        return res.status(200).send({
            user_id : result.rows[0].user_index,
            token : token
        });
    }
    catch(err){

        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        if(err instanceof TokenIssueError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.getFavoriteExpert = async(req,res) =>{
    const pg = new postgres();
    const userId = req.params.userid;

    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT profile_img_url, name, introduction_contents, (SELECT COUNT(*) FROM knock.expert_review AS review WHERE review.expert_index = expert.expert_index) AS review_count, (SELECT expert_type AS type FROM knock.have_expert_type INNER JOIN knock.expert_type ON have_expert_type.expert_index = expert.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index)
            FROM knock.expert
            WHERE expert_index IN (SELECT expert_index FROM knock.favorite_expert WHERE user_index = $1);
            `
        ,[userId]);

        return res.status(200).send({
            expertList : result.rows
        })
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        pg.disconnect();
    }
}

module.exports.getServiceUsageHistories = async(req, res) =>{
    const pg = new postgres();
    const userId = req.params.userid;
    try{
        await pg.connect();
        await parameter.nullCheck(userId);
        const result = await pg.queryExecute(
            `
            SELECT payment_info.payment_key, expert.expert_index AS expert_id, expert.name AS expert_name,
                (SELECT expert_type FROM knock.have_expert_type 
                INNER JOIN knock.expert_type 
                ON have_expert_type.expert_index = psychology_payment.expert_index 
                AND have_expert_type.expert_type_index = expert_type.expert_type_index)
            , profile_img_url,
                (SELECT array_agg(type) FROM knock.counseling_type INNER JOIN knock.expert_counseling_type ON expert_counseling_type.expert_index = expert.expert_index AND counseling_type.counseling_type_index = expert_counseling_type.counseling_type_index) AS counseling_type
            , product_name, status AS payment_status, payment_date, counseling_status
            FROM knock.psychology_payment
            INNER JOIN knock.payment_info
            ON psychology_payment.user_index = $1 AND payment_info.payment_key = psychology_payment.payment_key 
            INNER JOIN knock.expert
            ON expert.expert_index = psychology_payment.expert_index
            UNION
            SELECT payment_info.payment_key, null, null, null, null, null, product_name, status AS payment_status, payment_date, counseling_type
            FROM knock.payment_info
            INNER JOIN knock.test_payment
            ON test_payment.user_index = $1 AND test_payment.payment_key = payment_info.payment_key
            AND payment_info.status != 'CANCLE';
            `,[userId]);
        
        return res.status(200).send(result.rows);
    }
    catch(err){
        
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.getServiceUsageHistoriesDetail = async(req, res)=>{
    const pg = new postgres();
    const paymentKey = req.params.paymentKey;
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT title, content 
            FROM knock.service_progress
            WHERE payment_key = $1
            ORDER BY created_at;
            `
        ,[paymentKey])

        return res.status(200).send({ progressMessageList : result.rows})
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
        
        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.getTestReview = async(req,res) =>{
    const pageCount = (req.params.pageCount-1) * 20 || 0;
    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_reviews_index AS review_id, expert_review.user_index AS user_id, reviews AS review, writed_at, is_best, counseling_type
            FROM knock.expert_review
            INNER JOIN knock.test_payment USING (payment_key)
            WHERE is_opened = true
            LIMIT 20 OFFSET $1
            `
        ,[pageCount]);
     
        return res.status(200).send({
            reviewList : result.rows
        })
    }
    catch(err){
        console.log(err);
        if(err instanceof PostgreConnectionError)
        return res.status(500).send();
    
        if(err instanceof SqlSyntaxError)
        return res.status(500).send();

        if(err instanceof NullParameterError)
        return res.status(400).send();
    }
    finally{
        pg.disconnect();
    }

}

module.exports.createReview = async(req,res) =>{
    const pg = new postgres();
    const {userId, paymentKey, gpa, review} = req.body;

    
    try{
        await parameter.nullCheck(paymentKey, gpa, review, userId);
        await pg.connect();
        await pg.queryUpdate('BEGIN;',[]);
        const result = await pg.queryExecute(
            `
            INSERT INTO knock.expert_review (user_index, expert_index, payment_key, reviews, gpa, is_best, is_opened, writed_at)
                SELECT payment_info.user_index, psychology_payment.expert_index, payment_info.payment_key, $1, $2::float, false, true, NOW()
                FROM knock.payment_info 
                INNER JOIN knock.psychology_payment
                ON payment_info.payment_key = $3 AND payment_info.payment_key = psychology_payment.payment_key
                UNION
                SELECT payment_info.user_index, test.expert_index, payment_info.payment_key, $1, $2::float, false, true, NOW()
                FROM knock.payment_info
                INNER JOIN (SELECT expert_index, test_payment.payment_key 
                            FROM knock.test_payment 
                            INNER JOIN knock.allotted_test
                            ON test_payment.payment_key = $3 AND test_payment.payment_key = allotted_test.payment_key) AS test
                USING (payment_key)
                returning user_index;
            `
        ,[review, gpa, paymentKey]);

        if(userId != result.rows[0].user_index){
            await pg.queryUpdate('ROLLBACK;',[])
            return res.status(403).send();
        }
        
        await pg.queryUpdate('COMMIT');    
        return res.status(200).send();
    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError){
            await pg.queryUpdate('ROLLBACK;',[])
            return res.status(500).send();
        }

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.getCouponList = async(req,res) =>{
    const pg = new postgres();
    const userId = req.params.userId;
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT name, description, CONCAT(to_char(have_coupon.available_period, 'YYYY.MM.DD'), ' 까지') AS available_period, 
            CASE WHEN payment_key IS NOT NULL THEN '사용 완료'
                WHEN have_coupon.available_period < NOW() THEN '기간 만료'
                ELSE '사용 가능'
            END AS coupon_status
            FROM knock.coupon
            INNER JOIN knock.have_coupon
            ON user_index = $1 AND have_coupon.coupon_index = coupon.coupon_index;
            `
        ,[userId])
        return res.status(200).send({
            couponList : result.rows
        });

    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.getAvailableCouponList = async(req,res)=>{
    const pg = new postgres();
    const {userId, productType} = req.params;
    try{
        await parameter.nullCheck(userId, productType);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT have_coupon.coupon_index AS coupon_id, name, discount_amount
            FROM knock.coupon
            INNER JOIN knock.have_coupon
            ON user_index = $1 
            AND have_coupon.coupon_index = coupon.coupon_index
            AND type = $2
            AND have_coupon.available_period > NOW()
            AND payment_key is NULL;
            `
        ,[userId, productType])
        return res.status(200).send({
            couponList : result.rows
        });

    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.isThereUnconfirmedAlarm = async(req,res)=>{

    const pg = new postgres();
    const userId = req.params.userid;
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT alarm_index 
            FROM knock.alarm
            WHERE user_index = $1 AND is_checked = false
            LIMIT 1;
            `
        ,[userId])

        if(result.rowCount == 0)
            return res.status(404).send();
        
        return res.status(200).send();
    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.isVaildAffiliateCode = async(req,res)=>{
    const pg = new postgres();
    const code = req.params.code;
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT user_index
            FROM knock.affiliate_code
            WHERE code = $1 AND user_index IS NULL;
            `
        ,[code])

        if(result.rowCount ==0)
            return res.status(404).send();
        
        return res.status(200).send();
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
        
        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.authenticateAffiliate =async(req,res)=>{
    const pg = new postgres();
    const code = req.body.code;
    const userId = req.params.userId;
    try{
        await parameter.nullCheck(code, userId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            UPDATE knock.affiliate_code
            SET user_index = $1
            WHERE code = $2 AND user_index IS NULL;
            `
        ,[userId, code])

        if(result.rowCount == 0){   // 업데이트가 이뤄지지 않았을 시
            const isVaildCode = await pg.queryExecute(
                `
                SELECT user_index FROM knock.affiliate_code
                WHERE code = $1
                `
            ,[code]);
            
            if(isVaildCode.rowCount == 0)   // 코드가 유효하지 않은 코드라면
                return res.status(404).send();
                                            // 코드는 유효하지만 이미 사용된 코드라면
            return res.status(409).send();
        }

        return res.status(200).send();
    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
        
        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.answerPreQuestion = async(req,res)=>{
    const paymentKey = req.params.paymentKey;
    const {sex, birthDate, job, education, subject, offlineCounseling, onlineCounseling, medicineTherapy, personality, counselingMotive, hope} = req.body;
    const pg = new postgres();

    try{
        await parameter.nullCheck(paymentKey, sex, birthDate, job, education, subject, offlineCounseling, 
                                    onlineCounseling, medicineTherapy, personality, counselingMotive, hope);
        await pg.connect();
        await pg.queryUpdate(
            `
            INSERT INTO knock.pre_question_answer VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
            `
        ,[paymentKey, sex, birthDate, job, education, subject, offlineCounseling, onlineCounseling, medicineTherapy, personality, counselingMotive, hope]);

        return res.status(200).send();
    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.getPaymentDetail = async(req,res) =>{
    const pg = new postgres();
    const paymentKey = req.params.paymentKey;
    let discountAmount =0;
    try{
        await parameter.nullCheck(paymentKey);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT payment_key, to_char(payment_date, 'YYYY.DD.MM. HH:MI') AS payment_date,
            CASE WHEN status = 'DONE' THEN '결제완료' ELSE '결제취소' END AS payment_status,
            order_id, original_price, payment_method, COALESCE((SELECT discount_amount FROM knock.have_coupon INNER JOIN knock.coupon ON payment_key = $1 AND coupon.coupon_index = have_coupon.coupon_index), '0') AS discount_amount
            FROM knock.payment_info;
            `
        ,[paymentKey]);
            console.log(result.rows[0])
        if((result.rows[0].discount_amount).slice(-1) == "%"){
            discountRate = Number(result.rows[0].discount_amount.substring(0, result.rows[0].discount_amount.length-1)) / 100;
            discountAmount = result.rows[0].original_price * discountRate;
        }
        else
            discountAmount = result.rows[0].discount_amount;
        
        return res.status(200).send({
            payment_key : result.rows[0].payment_key,
            payment_date : result.rows[0].payment_date,
            payment_status : result.rows[0].payment_status,
            order_id : result.rows[0].order_id,
            original_price : result.rows[0].original_price,
            payment_method : result.rows[0].payment_method,
            discount_amount : Number(discountAmount),
            total_amount : (result.rows[0].original_price - Number(discountAmount))
        })
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError)
            return res.status(500).send();

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}