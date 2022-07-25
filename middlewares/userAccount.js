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
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
        `
        SELECT alarm_index AS alarm_id, title, content, created_at, is_checked FROM knock.alarm WHERE user_index = $1;
        `,
        [userId]);
        
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
            SELECT id AS email, nickname, email_certification AS is_email_certified, affiliates, is_left, is_blocked FROM knock.users WHERE user_index = $1;
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

module.exports.getAvailableCoupon = async(req,res) =>{
    const pg = new postgres();
    const userId = req.params.userid;
    const productName = req.params.productName;
    try{
        await parameter.nullCheck(userId, productName);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT coupon_index AS coupon_id, name, description, available_period FROM knock.have_coupon 
            INNER JOIN knock.coupon 
            ON have_coupon.user_index = $1 
            AND (coupon.type = $2 OR coupon.type = 'all');
            AND have_coupon.payment_key IS NULL
            AND available_period < NOW()
            AND have_coupon.coupon_index = coupon.coupon_index
            `
            ,[userId, productName]);
        
        return res.status(200).send(result.rows)
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
            ,profile_img_url,
                (SELECT array_agg(type) FROM knock.counseling_type INNER JOIN knock.expert_counseling_type ON expert_counseling_type.expert_index = expert.expert_index AND counseling_type.counseling_type_index = expert_counseling_type.counseling_type_index) AS counseling_type
            , product_name, status AS payment_status, payment_date, counseling_status
            FROM knock.psychology_payment
            INNER JOIN knock.payment_info
            ON psychology_payment.user_index = $1 AND  payment_info.payment_key = psychology_payment.payment_key 
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

module.exports.getTestReview = async(req,res) =>{
    const pageCount = (req.params.pageCount-1) * 20 || 0;
    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_reviews_index AS review_id, expert_review.user_index AS user_id, reviews AS review, writed_at, is_best
            FROM knock.expert_review
            INNER JOIN knock.test_payment USING (payment_key)
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