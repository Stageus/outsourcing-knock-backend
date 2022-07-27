const postgres = require('../database/pg');
const mongodb = require("../database/MongoDB");
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, CreatedHashedPaswordError, TokenIssueError} = require('../errors/error');
const hasing = require('../utils/password');
const jwtToken = require('../utils/jwtToken');


module.exports.login = async(req,res) =>{
        
    const email = req.body.email;
    const password = req.body.password;
    const pg = new postgres();
    try{
        await parameter.nullCheck(email, password);
        const hashedPassword = await hasing.createHashedPassword(password);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT admin_index FROM knock.super_admin WHERE email = $1 AND password = $2;
            `
        ,[email, hashedPassword]);
        if(result.rowCount == 0)       // id, password 쌍이 존재하지 않을 경우
            return res.status(401).send();
        
        const token = await jwtToken.issueAdminToken(result.rows[0].admin_index);

        return res.status(200).send({
            token : token,
            name : '이정찬'
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

        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }

}

module.exports.searchUser = async(req,res)=>{
    const searchWord = '%'+ req.body.searchWord +'%';
    const searchCategory = req.body.searchCategory;
    const startDate = req.body.startDate || '0001-01-01 00:00:00';
    const endDate = req.body.endDate || '9999-12-31 23:59:59';

    const pg = new postgres();
    let category = null;

    if(searchCategory == "이메일")
        category = "id";
    else if(searchCategory == "닉네임")
        category = "nickname";
    else if(searchCategory == "회원번호")
        category ="CAST(user_index AS TEXT)"
    
    try{
        await parameter.nullCheck(searchWord, category, startDate, endDate);
        await pg.connect(); 
        const result = await pg.queryExecute(
            `
            SELECT user_index AS user_id, id AS email, nickname, to_char(created_at,'YYYY.MM.DD') AS created_at, is_blocked, is_left
            FROM knock.users
            WHERE ${category} LIKE $1 
            AND created_at BETWEEN $2 AND $3
            `
        ,[searchWord, startDate, endDate]);
        return res.status(200).send({
            totalPageCount : Math.ceil((result.rowCount/10)),
            userList : result.rows
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

module.exports.modifyUserBlockingStatus =async(req,res) =>{
    const isBlocked = req.body.isBlocked;
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(isBlocked, userId);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users
            SET is_blocked = $1
            WHERE user_index = $2;
            `
            ,[isBlocked, userId]);

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

module.exports.checkDuplicatedEmail =async(req,res) =>{
    const email = req.params.email;
    const pg = new postgres();
    try{
        await parameter.nullCheck(email);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT id FROM knock.users 
            WHERE id = $1;
            `
            ,[email]);
        
        if(result.rowCount == 0)
            return res.status(404).send();
        else
            return res.status(200).send();
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

module.exports.getUserReviewList =async(req,res) =>{
    const userId = req.params.userid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_reviews_index AS review_id, order_id, reviews AS review, CAST(gpa AS numeric(2,1)), counseling_type, to_char(writed_at, 'YYYY.MM.DD') AS writed_at, 
                (SELECT name FROM knock.expert WHERE expert_index = expert_review.expert_index),(SELECT expert_type FROM knock.expert_type 
                INNER JOIN knock.have_expert_type 
                ON have_expert_type.expert_index = expert_review.expert_index 
                AND have_expert_type.expert_type_index = expert_type.expert_type_index),
            (SELECT nickname FROM knock.users WHERE user_index = $1) 
            FROM knock.expert_review 
            INNER JOIN knock.payment_info 
            ON expert_review.user_index = $1 AND payment_info.payment_key = expert_review.payment_key;
            `
            ,[userId]);
        
            return res.status(200).send({
                reviewList : result.rows,
                totalPageCount : Math.ceil(result.rowCount / 10)
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

module.exports.getUserReview = async(req,res) =>{
    const userId = req.params.userid;
    const reviewId = req.params.reviewid;
    const pg = new postgres();
    try{
        await parameter.nullCheck(userId, reviewId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_reviews_index AS review_id, order_id, reviews AS review, CAST(gpa AS numeric(2,1)), counseling_type, to_char(writed_at, 'YYYY.MM.DD') AS writed_at, (SELECT name FROM knock.expert WHERE expert_index = expert_review.expert_index),(SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON have_expert_type.expert_index = expert_review.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index),(SELECT nickname FROM knock.users WHERE user_index = $1) FROM knock.expert_review INNER JOIN knock.payment_info USING (payment_key)
            WHERE expert_reviews_index = $2;
            `
            ,[userId, reviewId]);
        
            return res.status(200).send(result.rows[0]);
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

module.exports.deleteUserReview =async(req,res) =>{
    const reviewIdList = req.body.reviewIdList;
    console.log(reviewIdList);
    const pg = new postgres();
    query = '';
    try{
        await parameter.nullCheck(reviewIdList);
        for(i=1; i<=reviewIdList.length; i++){
            query += `$${i}`;
            if(i!= reviewIdList.length)
                query +=', ';
        }
        await pg.connect();
        await pg.queryUpdate(
            `
            DELETE FROM knock.expert_review
            WHERE expert_reviews_index IN (${query});
            `
            ,reviewIdList);
        
            return res.status(200).send();
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

module.exports.searchExpert = async(req,res)=>{
    const searchWord = '%'+ req.body.searchWord +'%';
    const searchCategory = req.body.searchCategory;
    const expertType = req.body.expertType;
    const startDate = req.body.startDate || '0001-01-01 00:00:00';
    const endDate = req.body.endDate || '9999-12-31 23:59:59';
    const pg = new postgres();
    let category = null;

    if(searchCategory == "이름")
        category = "name";
    else if(searchCategory == "연락처")
        category = "phone_number";
    
    try{
        await parameter.nullCheck(searchWord, expertType, category, startDate, endDate);
        await pg.connect(); 
        const result = await pg.queryExecute(
            `
            SELECT expert.expert_index AS expert_id , name, expert_type, phone_number, to_char(created_at, 'YYYY.MM.DD') AS created_at, is_blocked, is_inactivated, expert_status
            FROM knock.expert
            INNER JOIN (SELECT expert_index, expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON expert_type = $1 AND have_expert_type.expert_type_index = expert_type.expert_type_index) AS type
            ON ${category} LIKE $2 
            AND type.expert_index = expert.expert_index 
            AND created_at BETWEEN $3 AND $4
            ORDER BY created_at;
            `
        ,[expertType, searchWord, startDate, endDate]);
        return res.status(200).send({
            totalPageCount : Math.ceil((result.rowCount/10)),
            expertList : result.rows
        })
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

module.exports.searchCounseling = async(req,res)=>{
    const searchWord = '%'+ req.body.searchWord +'%';
    const searchCategory = req.body.searchCategory;
    const counselingType = req.body.counselingType;
    const counselingStatus = req.body.counselingStatus;
    const startDate = req.body.startDate || '0001-01-01 00:00:00';
    const endDate = req.body.endDate || '9999-12-31 23:59:59';
    const pg = new postgres();
    let searchWordCondition = null;
    let counseligTypeCondtion = '';

    try{
        await parameter.nullCheck(searchWord, counselingType, counselingStatus, searchCategory, startDate, endDate);
        if(searchCategory == "닉네임")
            searchWordCondition = "payment_info.user_index = (SELECT user_index FROM knock.users WHERE nickname LIKE $1)"
        else if(searchCategory == "전문가")
            searchWordCondition = "expert_index = (SELECT expert_index FROM knock.expert WHERE name LIKE $1)"

        for(i=0; i<counselingType.length; i++){
            if(counselingType[i] == "음성")
                counseligTypeCondtion += `'음성'`
            else if(counselingType[i] == "채팅")
                counseligTypeCondtion += `'채팅'`

            if(i != counselingType.length-1)
                counseligTypeCondtion += ', ';
        }

        await pg.connect(); 
        const result = await pg.queryExecute(
            `
            SELECT payment_info.payment_key, (SELECT nickname FROM knock.users WHERE user_index = payment_info.user_index), ( SELECT name FROM knock.expert WHERE expert_index = psychology_payment.expert_index), 
            (SELECT expert_type FROM knock.expert_type 
                INNER JOIN knock.have_expert_type ON have_expert_type.expert_index = psychology_payment.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index), counseling_type, status AS payment_status, counseling_status, to_char(counseling_start_time, 'YYYY.MM.DD / HH24:MI') AS counseling_time
            FROM knock.payment_info
            INNER JOIN knock.psychology_payment
            ON ${searchWordCondition}
            AND counseling_status = $2 
            AND counseling_type IN (${counseligTypeCondtion})
            AND counseling_start_time BETWEEN $3 AND $4
            AND payment_info.payment_key = psychology_payment.payment_key
            AND status != 'WAITING_FOR_DEPOSIT'
            ORDER BY counseling_start_time
            `
        ,[searchWord, counselingStatus, startDate, endDate]);

        return res.status(200).send({
            totalPageCount : Math.ceil((result.rowCount/10)),
            counselingList : result.rows
        })
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

module.exports.searchTest = async(req,res)=>{
    const searchWord = '%'+ req.body.searchWord +'%';
    const searchCategory = req.body.searchCategory;
    const counselingStatus = req.body.counselingStatus;
    const startDate = req.body.startDate || '0001-01-01 00:00:00';
    const endDate = req.body.endDate || '9999-12-31 23:59:59';
    const pg = new postgres();
    let searchWordCondition = null;


    try{
        await parameter.nullCheck(searchWord, searchCategory, counselingStatus, startDate, endDate);
        if(searchCategory == "결제상품번호")
            searchWordCondition = "WHERE test_payment.payment_key LIKE $1"
        else if(searchCategory == "회원번호")
            searchWordCondition = "WHERE CAST(test_payment.user_index AS TEXT) LIKE $1"
        else if(searchCategory == "닉네임")
            searchWordCondition = "WHERE test_payment.user_index IN (SELECT user_index FROM knock.users WHERE nickname LIKE $1)"
        else if(searchCategory == "전문가")
            searchWordCondition ="WHERE allotted_test.expert_index IN (SELECT expert_index FROM knock.expert WHERE name LIKE $1)"

        await parameter.nullCheck(searchWordCondition);
        await pg.connect(); 
        const result = await pg.queryExecute(
            `
            SELECT T.payment_key, T.user_index AS user_id,(SELECT nickname FROM knock.users WHERE user_index = T.user_index), (SELECT name FROM knock.expert WHERE expert_index = T.expert_index), counseling_status, to_char(T.counseling_start_time, 'YYYY.MM.DD / HH24:MI') AS counseling_time
            FROM knock.payment_info
            INNER JOIN (SELECT test_payment.payment_key, user_index, allotted_test.expert_index, counseling_start_time FROM knock.test_payment LEFT JOIN knock.allotted_test USING (payment_key) ${searchWordCondition}) AS T
            ON payment_info.payment_key = T.payment_key
            AND T.counseling_start_time BETWEEN $2 AND $3
            AND status = 'DONE'
            AND counseling_status = $4 AND counseling_status != '검사대기'
            ORDER BY sounseling_start_time;
            `
        ,[searchWord, startDate, endDate, counselingStatus]);

        return res.status(200).send({
            totalPageCount : Math.ceil((result.rowCount/10)),
            testList : result.rows
        })
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

module.exports.getAllUserList = async(req,res) =>{
    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT user_index AS user_id, id AS email, nickname, to_char(created_at, 'YYYY.MM.DD') AS created_at, is_blocked, is_left
            FROM knock.users
            ORDER BY created_at;
            `
        ,[]);

        return res.status(200).send({
            userList : result.rows,
            totalPageCount : Math.ceil((result.rowCount/10))
        }
        )
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.getAllExpertList = async(req,res) =>{
    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_index AS expert_id, name, phone_number AS phone, to_char(created_at, 'YYYY.MM.DD') AS created_at, is_blocked, is_inactivated, expert_status, (SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON have_expert_type.expert_index = expert.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index)
            FROM knock.expert
            ORDER BY created_at;
            `
        ,[]);

        return res.status(200).send({
            expertList : result.rows,
            totalPageCount : Math.ceil((result.rowCount/10))
        }
        )
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.getAllcounselingList = async(req,res) =>{
    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT payment_info.payment_key, (SELECT nickname FROM knock.users WHERE user_index = payment_info.user_index), ( SELECT name FROM knock.expert WHERE expert_index = psychology_payment.expert_index), counseling_type, status AS payment_status, counseling_status, to_char(counseling_start_time, 'YYYY.MM.DD / HH24:MI') AS counseling_time, 
            (SELECT expert_type FROM knock.expert_type 
                INNER JOIN knock.have_expert_type ON have_expert_type.expert_index = psychology_payment.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index)
            FROM knock.payment_info
            INNER JOIN knock.psychology_payment
            ON psychology_payment.payment_key = payment_info.payment_key
            ORDER BY counseling_start_time;
            `
        ,[]);

        return res.status(200).send({
            counselingList : result.rows,
            totalPageCount : Math.ceil((result.rowCount/10))
        }
        )
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
    
}

module.exports.getAllTestList = async(req,res) =>{
    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT T.payment_key, T.user_index AS user_id,(SELECT nickname FROM knock.users WHERE user_index = T.user_index), (SELECT name FROM knock.expert WHERE expert_index = T.expert_index), counseling_status, to_char(T.counseling_start_time, 'YYYY.MM.DD / HH24:MI') AS counseling_time
            FROM knock.payment_info
            INNER JOIN (SELECT test_payment.payment_key, user_index, allotted_test.expert_index, counseling_start_time 
                        FROM knock.test_payment 
                        LEFT JOIN knock.allotted_test 
                        USING (payment_key)) AS T
            ON payment_info.payment_key = T.payment_key
            AND status = 'DONE' AND counseling_status != '검사대기'
            ORDER BY counseling_start_time;
            `
        ,[]);

        return res.status(200).send({
            testList : result.rows,
            totalPageCount : Math.ceil((result.rowCount/10))
        }
        )
    }
    catch(err){
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();

        if(err instanceof SqlSyntaxError)
            return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.modifyUserInformation =async (req,res) =>{
    const pg = new postgres();
    const isBlocked = req.body.isBlocked;
    const email = req.body.email;
    const userId = req.params.userid;
    try{
        await parameter.nullCheck(isBlocked, userId);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.users
            SET is_blocked = $1, id = $2
            WHERE user_index = $3;
            `
        ,[isBlocked, email, userId]);

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
        await pg.disconnect();
    }
}

module.exports.getAllBannerList = async(req,res) =>{

    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT banner_index AS banner_id, title_img_url, title, banner_order, is_opened, to_char(created_at, 'YYYY.MM.DD') AS created_at
            FROM knock.banner
            ORDER BY created_at;
            `
        ,[])

        return res.status(200).send({
            bannerList : result.rows,
            totalPageCount : Math.ceil(result.rowCount/10)
        })
        
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

module.exports.getBannerDetail = async(req,res) =>{
    const pg = new postgres();
    const bannerId = req.params.bannerId;
    try{
        await parameter.nullCheck(bannerId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT banner_index AS banner_id, title_img_url, content_img_url, is_opened, banner_order, title 
            FROM knock.banner
            WHERE banner_index = $1;
            `
        ,[bannerId]);
        
        return res.status(200).send(result.rows[0])
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

module.exports.searchBannerList = async(req,res) =>{
    const pg = new postgres();
    const searchWord = '%'+req.body.searchWord+'%';
    const startDate = req.body.startDate || '0001-01-01 00:00:00';
    const endDate = req.body.endDate || '9999-12-31 23:59:59';
    const isOpened = req.body.isOpened;
    let openCondition = '';
    try{
        await parameter.nullCheck(searchWord, startDate, endDate, isOpened);

        for(i=0; i<isOpened.length; i++){
            if(isOpened[i] == "전체"){
                openCondition = "true, false";
                break;
            }
            else if(isOpened[i] == "Y")
                openCondition += "true";
            else if(isOpened[i] == "N")
                openCondition += "false";

            if(i != isOpened.length-1)
                openCondition +=", ";
        }
        
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT banner_index AS banner_id, title_img_url, title, banner_order, is_opened, to_char(created_at, 'YYYY.MM.DD')
            FROM knock.banner
            WHERE title LIKE $1
            AND created_at BETWEEN $2 AND $3
            AND is_opened IN (${openCondition});
            `
        ,[searchWord, startDate, endDate]);
        return res.status(200).send({
            bannerList : result.rows,
            totalPageCount : Math.ceil(result.rowCount/10)
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


module.exports.getAllPaymentList = async(req,res) =>{

    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT payment_key, 
            CASE WHEN status = 'DONE' THEN '결제완료' ELSE '결제취소' END AS payment_status, (SELECT nickname FROM knock.users WHERE user_index = payment_info.user_index), 
            COALESCE((SELECT name FROM knock.expert WHERE expert_index = test.expert_index), '미정') AS expert_name, '심리검사' AS product_type, price, to_char(payment_date, 'YYYY.MM.DD') AS payment_date
            FROM knock.payment_info INNER JOIN (SELECT payment_key,expert_index FROM knock.test_payment INNER JOIN knock.allotted_test USING (payment_key)) AS test
            USING (payment_key)
            UNION
            SELECT payment_key, 
            CASE WHEN status = 'DONE' THEN '결제완료' ELSE '결제취소' END AS payment_status, (SELECT nickname FROM knock.users WHERE user_index = payment_info.user_index), 
            (SELECT name FROM knock.expert WHERE expert_index = psychology_payment.expert_index) AS expert_name, 
            CASE WHEN (SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON expert_index = psychology_payment.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index) = '정신건강의학과 전문의' THEN '전문가 상담' ELSE '심리상담' END AS product_type,
            price, to_char(payment_date, 'YYYY.MM.DD') AS payment_date
            FROM knock.payment_info INNER JOIN knock.psychology_payment 
            USING (payment_key)
            WHERE status != 'WAITING_FOR_DEPOSIT'
            ORDER BY payment_date;
            `
        ,[])

        return res.status(200).send({
            paymentList : result.rows,
            totalPageCount : Math.ceil(result.rowCount/10)
        })
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

module.exports.searchPaymentList = async(req,res) =>{

    const pg = new postgres();
    const searchWord = '%'+req.body.searchWord+'%';
    const startDate = req.body.startDate || '0001-01-01 00:00:00';
    const endDate = req.body.endDate || '9999-12-31 23:59:59';
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT payment_key, 
            CASE WHEN status = 'DONE' THEN '결제완료' ELSE '결제취소' END AS payment_status, (SELECT nickname FROM knock.users WHERE user_index = payment_info.user_index), 
            COALESCE((SELECT name FROM knock.expert WHERE expert_index = test.expert_index), '미정') AS expert_name, '심리검사' AS product_type, price, to_char(payment_date, 'YYYY.MM.DD') AS payment_date
            FROM knock.payment_info INNER JOIN (SELECT payment_key,expert_index FROM knock.test_payment INNER JOIN knock.allotted_test USING (payment_key)) AS test
            USING (payment_key)
            WHERE status != 'WAITING_FOR_DEPOSIT'
            UNION
            SELECT payment_key, 
            CASE WHEN status = 'DONE' THEN '결제완료' ELSE '결제취소' END AS payment_status, (SELECT nickname FROM knock.users WHERE user_index = payment_info.user_index), 
            (SELECT name FROM knock.expert WHERE expert_index = psychology_payment.expert_index) AS expert_name, 
            CASE WHEN (SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON expert_index = psychology_payment.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index) = '정신건강의학과 전문의' THEN '전문가 상담' ELSE '심리상담' END AS product_type,
            price, to_char(payment_date, 'YYYY.MM.DD') AS payment_date
            FROM knock.payment_info INNER JOIN knock.psychology_payment 
            USING (payment_key)
            WHERE status != 'WAITING_FOR_DEPOSIT'
            ORDER BY payment_date;
            `
        ,[])

        return res.status(200).send({
            paymentList : result.rows,
            totalPageCount : Math.ceil(result.rowCount/10)
        })
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

module.exports.getPaymentDetail = async(req,res) =>{
    const pg = new postgres();
    const paymentKey = req.params.paymentKey;
    try{
        await parameter.nullCheck(paymentKey);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT payment_info.payment_key, 
            CASE WHEN status = 'DONE' THEN '결제완료' ELSE '결제취소' END AS payment_status, (SELECT nickname FROM knock.users WHERE user_index = payment_info.user_index), 
            COALESCE((SELECT name FROM knock.expert WHERE expert_index = test.expert_index), '미정') AS expert_name, '심리검사' AS product_type, price, to_char(payment_date, 'YYYY.MM.DD HH:MI:SS') AS payment_date, payment_method, COALESCE(to_char(counseling_start_time, 'YYYY.MM.DD / HH:MI'), '미정') AS counseling_time
            FROM knock.payment_info INNER JOIN (SELECT payment_key,expert_index, counseling_start_time FROM knock.test_payment INNER JOIN knock.allotted_test USING (payment_key)) AS test
            ON payment_info.payment_key = $1 AND payment_info.payment_key = test.payment_key
            UNION
            SELECT payment_info.payment_key, 
            CASE WHEN status = 'DONE' THEN '결제완료' ELSE '결제취소' END AS payment_status, (SELECT nickname FROM knock.users WHERE user_index = payment_info.user_index), 
            (SELECT name FROM knock.expert WHERE expert_index = psychology_payment.expert_index) AS expert_name, 
            CASE WHEN (SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON expert_index = psychology_payment.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index) = '정신건강의학과 전문의' THEN '전문가 상담' ELSE '심리상담' END AS product_type,
            price, to_char(payment_date, 'YYYY.MM.DD HH:MI:SS') AS payment_date, payment_method, to_char(counseling_start_time, 'YYYY.MM.DD / HH:MI') AS counseling_time
            FROM knock.payment_info INNER JOIN knock.psychology_payment 
            ON payment_info.payment_key = $1 AND payment_info.payment_key = psychology_payment.payment_key
            ORDER BY payment_date;
            `
        ,[paymentKey]);

        return res.status(200).send(result.rows[0])
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


module.exports.getAllReviewList = async(req,res) =>{
    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_reviews_index AS review_id, 'MHSQ 검사' AS product_name, (SELECT nickname FROM knock.users WHERE user_index = expert_review.user_index), '심리검사' AS product_type, to_char(writed_at, 'YYYY.MM.DD') AS writed_at, is_best, is_opened, CAST(gpa AS numeric(2,1))
            FROM knock.expert_review INNER JOIN knock.test_payment USING(payment_key)
            UNION
            SELECT expert_reviews_index AS review_id, CONCAT((SELECT name FROM knock.expert WHERE expert_index = expert_review.expert_index), ' ', (SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON expert_index = expert_review.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index)) AS product_name, (SELECT nickname FROM knock.users WHERE user_index = expert_review.user_index), 
            CASE WHEN (SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON expert_index = psychology_payment.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index) = '정신건강의학과 전문의' THEN '전문가 상담' ELSE '심리상담' END, to_char(writed_at, 'YYYY.MM.DD') AS writed_at, is_best, is_opened, CAST(gpa AS numeric(2,1))
            FROM knock.expert_review INNER JOIN knock.psychology_payment USING(payment_key)
            ORDER BY writed_at;
            `
        ,[])

        return res.status(200).send({
            reviewList : result.rows,
            totalPageCount : Math.ceil(result.rowCount/10)
        })
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

module.exports.getReviewDetail = async(req,res) =>{
    const pg = new postgres();
    const reviewId = req.params.reviewId;
    try{
        await parameter.nullCheck(reviewId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT expert_reviews_index AS review_id, reviews, 'MHSQ 검사' AS product_name, (SELECT nickname FROM knock.users WHERE user_index = expert_review.user_index), '심리검사' AS product_type, to_char(writed_at, 'YYYY.MM.DD') AS writed_at, is_best, is_opened, CAST(gpa AS numeric(2,1))
            FROM knock.expert_review INNER JOIN knock.test_payment ON expert_reviews_index = $1 AND expert_review.payment_key = test_payment.payment_key
            UNION
            SELECT expert_reviews_index AS review_id, reviews, CONCAT((SELECT name FROM knock.expert WHERE expert_index = expert_review.expert_index), ' ', (SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON expert_index = expert_review.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index)) AS product_name, (SELECT nickname FROM knock.users WHERE user_index = expert_review.user_index), 
            CASE WHEN (SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON expert_index = psychology_payment.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index) = '정신건강의학과 전문의' THEN '전문가 상담' ELSE '심리상담' END, to_char(writed_at, 'YYYY.MM.DD') AS writed_at, is_best, is_opened, CAST(gpa AS numeric(2,1))
            FROM knock.expert_review INNER JOIN knock.psychology_payment ON expert_reviews_index = $1 AND expert_review.payment_key = psychology_payment.payment_key
            ORDER BY writed_at;
            `
        ,[reviewId]);

        return res.status(200).send(result.rows[0])
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

module.exports.modifyReview = async(req,res) =>{
    const reviewId = req.params.reviewId;
    const {isOpened, isBest, review} = req.body;
    const pg = new postgres();

    try{
        await parameter.nullCheck(reviewId, isOpened, isBest, review);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.expert_review
            SET is_opened = $1, is_best = $2, reviews = $3
            WHERE expert_reviews_index = $4; 
            `
        ,[isOpened, isBest, review, reviewId]);

        return res.status(200).send();
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

module.exports.getAllCouponList = async(req,res) =>{
    const pg = new postgres();
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT coupon_index AS coupon_id, name, available_count, CONCAT('생성일로부터 ',available_period,'일') AS available_period, to_char(created_at, 'YYYY.MM.DD HH:MI') AS created_at, active_status FROM knock.coupon;
            `
        ,[])
        return res.status(200).send({
            couponList : result.rows,
            totalPageCount : Math.ceil(result.rowCount/10)
        })
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

module.exports.searchCouponList = async(req,res) =>{
    const pg = new postgres();
    const status = req.body.status || "true, false";
    const searchWord = req.body.searchWord || "empty";
    let where = '';
    

    try{
        if(status != "true, false"){

        }
        else
            where = `WHERE active_status IN (${status})`;
    
        if(searchWord != "empty")
            where += `AND name LIKE '%${searchWord}%'`;

        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT coupon_index AS coupon_id, name, available_count, CONCAT('생성일로부터',available_period,'일') AS available_period, to_char(created_at, 'YYYY.MM.DD HH:MI') AS created_at, active_status FROM knock.coupon
            ${where}
            ORDER BY created_at;
            `
        ,[])
        return res.status(200).send({
            couponList : result.rows,
            totalPageCount : Math.ceil(result.rowCount/10)
        })
    }
    catch(err){
        console.log(err);
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

module.exports.createNormalCoupon = async(req,res)=>{
    const {name, description, discount, couponType, availableCount, availablePeriod, canGetOldUserToo} = req.body;
    const pg = new postgres();
    try{
        await parameter.nullCheck(name, description, discount, couponType, availableCount, availablePeriod, canGetOldUserToo);
        await pg.connect();
        await pg.queryUpdate('BEGIN;',[]);
        const result = await pg.queryExecute(
            `
            INSERT INTO knock.coupon VALUES (DEFAULT, $1, $2, $3, $4, $5, $6, NOW(), $7, $8)
            returning coupon_index;
            `
        ,[name, couponType, description, availablePeriod, true, 'knock', availableCount,discount])

        if(canGetOldUserToo){
            const userinfo = await pg.queryExecute(`SELECT COUNT(*), Array_agg(user_index) AS user_index FROM knock.users WHERE is_left = false AND is_blocked = false ORDER BY user_index`,[]);
            let userCouponPairIndex = '';
            
            for(i=0; i<userinfo.rows[0].count; i++){
                userCouponPairIndex += `(${userinfo.rows[0].user_index[i]}, ${result.rows[0].coupon_index}, null, DATE_TRUNC('day', NOW()) + INTERVAL '${availablePeriod} day')`
                if(i != userinfo.rows[0].count-1)
                    userCouponPairIndex += ", ";
            }

            for(i=0; i<availableCount; i++){
                await pg.queryUpdate(
                    `
                    INSERT INTO knock.have_coupon VALUES ${userCouponPairIndex}
                    `
                ,[]);
            }

        }

        await pg.queryUpdate('COMMIT;',[]);
        return res.status(200).send();
    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError){
            await pg.queryUpdate('ROLLBACK;',[]);
            return res.status(500).send();
        }
        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.getCouponDetail = async(req,res) =>{
    const pg = new postgres();
    const couponId = req.params.couponId;
    try{
        await parameter.nullCheck(couponId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT name, description, discount_amount, available_count, available_period, type, active_status
            FROM knock.coupon
            WHERE coupon_index = $1;
            `
        ,[couponId]);

        return res.status(200).send( result.rows[0]);
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

module.exports.modifyCoupon = async(req,res) =>{
    const pg = new postgres();
    const couponId = req.params.couponId;
    const {activeStatus, name, description} = req.body;
    try{
        await parameter.nullCheck(activeStatus, description, name, couponId);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.coupon SET active_status = $1, name = $2, description =$3
            WHERE coupon_index = $4;
            `
        ,[activeStatus, name, description, couponId]);

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

module.exports.getAffiliateList = async(req,res)=>{
    const pg = new postgres();

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT affiliate_index AS affiliate_id, company, manager, to_char(created_at, 'YYYY.MM.DD HH:MI') AS created_at, (SELECT COUNT(*) FROM knock.affiliate_code WHERE affiliate_index = affiliate.affiliate_index)
            FROM knock.affiliate;
            `
        ,[])
        return res.status(200).send({
            affiliateList : result.rows,
            totalPageCount : Math.ceil(result.rowCount/10)
        });
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

module.exports.getAffiliateDetail = async(req,res)=>{
    const affiliateId = req.params.affiliateId;
    const pg = new postgres();

    try{
        await parameter.nullCheck(affiliateId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT affiliate_index AS affiliate_id, company, manager FROM knock.affiliate WHERE affiliate_index = $1 ;
            `
        ,[affiliateId])
        return res.status(200).send(result.rows[0]);
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

module.exports.modifyAffiliate = async(req,res)=>{
    const affiliateId = req.params.affiliateId;
    const {company, manager} = req.body;
    const pg = new postgres();

    try{
        
        await parameter.nullCheck(affiliateId, company, manager);
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.affiliate SET company = $1, manager = $2
            WHERE affiliate_index = $3;
            `
        ,[company, manager, affiliateId])
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

module.exports.createAffiliate = async(req,res)=>{
    const pg = new postgres();
    const {affiliate, manager} = req.body;
    try{
        await parameter.nullCheck(affiliate, manager);
        await pg.connect();
        await pg.queryUpdate(
            `
            INSERT INTO knock.affiliate VALUES(DEFAULT, $1, $2, NOW());
            `
        ,[affiliate, manager]);
        return res.status(200).send();
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

module.exports.createAffiliateCode = async(req,res)=>{
    const pg = new postgres();
    const affiliateId = req.params.affiliateId;
    const {issueCount} = req.body;
    const queryArray = [];
    let queryValue = ''
    try{
        await parameter.nullCheck(issueCount, affiliateId);
        for(i=1; i<=issueCount; i++){
            queryArray.push(affiliateId);
            queryValue += `($${i}, '${await parameter.getAffiliateCode()}')`
            if(i != issueCount)
                queryValue +=', ';
        }
        
        await pg.connect();
        await pg.queryUpdate(
            `
            INSERT INTO knock.affiliate_code (affiliate_index, code) VALUES ${queryValue}
            `
        ,queryArray)

        return res.status(200).send();
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

module.exports.getAffiliateCodeList = async(req,res)=>{
    const pg = new postgres();
    const affiliateId = req.params.affiliateId;
    try{
        await parameter.nullCheck(affiliateId);
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT code FROM knock.affiliate_code WHERE affiliate_index = $1;
            `
        ,[affiliateId]);

        return res.status(200).send({
            affiliateCodeList : result.rows,
            totalPageCount : Math.ceil(result.rowCount/10)
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

module.exports.getAffiliateCouponList = async(req,res)=>{
    const pg = new postgres();
    const affiliateId = req.params.affiliateId;
    try{
        await parameter.nullCheck(affiliateId);
        await pg.connect();

        const result = await pg.queryExecute(
            `
            SELECT coupon_index AS coupon_id, name, available_count, CONCAT('생성일로부터 ',available_period,'일') AS available_period, to_char(created_at, 'YYYY.MM.DD HH:MI') AS created_at, active_status
            FROM knock.coupon
            WHERE affiliates = (SELECT company FROM knock.affiliate WHERE affiliate_index = $1);
            `
        ,[affiliateId])

        return res.status(200).send({
            affiliateCouponList : result.rows,
            totalPageCount : Math.ceil(result.rowCount/10)
        })
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

module.exports.createAffiliateCoupon = async(req,res)=>{
    const affiliateId = req.params.affiliateId;
    const {name, description, discount, couponType, availableCount, availablePeriod, canGetOldUserToo} = req.body;
    const pg = new postgres();
    try{
        await parameter.nullCheck(name, description, discount, couponType, availableCount, availablePeriod, canGetOldUserToo, affiliateId);
        await pg.connect();
        await pg.queryUpdate('BEGIN;',[]);
        const result = await pg.queryExecute(
            `
            INSERT INTO knock.coupon VALUES (DEFAULT, $1, $2, $3, $4, $5, (SELECT company FROM knock.affiliate WHERE affiliate_index = $6), NOW(), $7, $8)
            returning coupon_index;
            `
        ,[name, couponType, description, availablePeriod, true, affiliateId, availableCount,discount])

        if(canGetOldUserToo){
            const userinfo = await pg.queryExecute(`SELECT COUNT(*), Array_agg(user_index) AS user_index 
            FROM knock.users 
            WHERE is_left = false 
            AND is_blocked = false 
            AND affiliate = (SELECT company FROM knock.affiliate WHERE affiliate_index = $1) 
            ORDER BY user_index`
            ,[affiliateId]);
            let userCouponPairIndex = '';
            
            for(i=0; i<userinfo.rows[0].count; i++){
                userCouponPairIndex += `(${userinfo.rows[0].user_index[i]}, ${result.rows[0].coupon_index}, null, DATE_TRUNC('day', NOW()) + INTERVAL '${availablePeriod} day')`
                if(i != userinfo.rows[0].count-1)
                    userCouponPairIndex += ", ";
            }

            for(i=0; i<availableCount; i++){
                await pg.queryUpdate(
                    `
                    INSERT INTO knock.have_coupon VALUES ${userCouponPairIndex}
                    `
                ,[]);
            }
        }

        await pg.queryUpdate('COMMIT;',[]);
        return res.status(200).send();
    }
    catch(err){
        console.log(err);
        if(err instanceof NullParameterError)
            return res.status(400).send();
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError){
            await pg.queryUpdate('ROLLBACK;',[]);
            return res.status(500).send();
        }
        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

module.exports.modifyTerms = async(req,res) =>{
    const pg = new postgres();
    const newestList = req.body.newestList || [];
    const previousList = req.body.previousList || [];
    let insertValue = '';
    let updateValue = '';
    
    try{
        await pg.connect();
        await pg.queryUpdate('BEGIN;',[]);

        if(newestList.length != 0){
            newestList.forEach((elem, idx) => {
                insertValue += `('${elem.title}', ('${elem.contents}'), ${elem.is_activated})`
                if(idx != newestList.length-1)
                    insertValue +=', ';
            });
            await pg.queryUpdate(
                `
                INSERT INTO knock.terms_of_service (title, contents, is_activated) VALUES ${insertValue};
                `
            ,[])
        }
    
        if(previousList.length != 0){
            previousList.forEach(elem => {
                updateValue += `UPDATE knock.terms_of_service SET title = '${elem.title}', contents = '${elem.contents}', is_activated = ${elem.is_activated} WHERE terms_of_service_index = ${elem.terms_id};`
            });

            await pg.queryUpdate(
                `
                ${updateValue}
                `
            ,[])
        }
        await pg.queryUpdate('COMMIT;',[]);
        return res.status(200).send();
    }
    catch(err){
        
        if(err instanceof PostgreConnectionError)
            return res.status(500).send();
        if(err instanceof SqlSyntaxError){
            await pg.queryUpdate('ROLLBACK',[]);
            return res.status(500).send();
        }
        
        return res.status(500).send();
    }
    finally{
        await pg.disconnect();
    }
}

