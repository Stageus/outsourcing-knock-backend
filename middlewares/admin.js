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
    const pageCount = (req.params.pageCount-1) * 10;
    const pg = new postgres();
    let category = null;

    if(searchCategory == "이메일")
        category = "id";
    else if(searchCategory == "닉네임")
        category = "nickname";
    
    try{
        await parameter.nullCheck(searchWord, category, startDate, endDate, pageCount);
        await pg.connect(); 
        const result = await pg.queryExecute(
            `
            SELECT user_index AS user_id, id AS email, nickname, created_at, is_blocked, is_left
            FROM knock.users
            WHERE ${category} LIKE $1 
            AND created_at BETWEEN $2 AND $3
            LIMIT 10 OFFSET $4;
            `
        ,[searchWord, startDate, endDate, pageCount]);
        console.log(searchWord);
        return res.status(200).send({
            totalPageCount : Math.floor((result.rowCount/10))+1,
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
            SELECT expert_reviews_index AS review_id, order_id, reviews, gpa, counseling_type, writed_at, (SELECT name FROM knock.expert WHERE expert_index = expert_review.expert_index),(SELECT expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON have_expert_type.expert_index = expert_review.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index),(SELECT nickname FROM knock.users WHERE user_index = $1) FROM knock.expert_review INNER JOIN knock.payment_info USING (payment_key);
            `
            ,[userId]);
        
            return res.status(200).send({
                reviewList : result.rows
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
        console.log(query);
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

module.exports.searchExpert = async(req,res)=>{
    const searchWord = '%'+ req.body.searchWord +'%';
    const searchCategory = req.body.searchCategory;
    const expertType = req.body.expertType;
    const startDate = req.body.startDate || '0001-01-01 00:00:00';
    const endDate = req.body.endDate || '9999-12-31 23:59:59';
    const pageCount = (req.params.pageCount-1) * 10 || 0;
    const pg = new postgres();
    let category = null;

    if(searchCategory == "이름")
        category = "name";
    else if(searchCategory == "연락처")
        category = "phone_number";
    
    try{
        await parameter.nullCheck(searchWord, expertType, category, startDate, endDate, pageCount);
        await pg.connect(); 
        const result = await pg.queryExecute(
            `
            SELECT expert.expert_index AS expert_id , name, expert_type, phone_number, created_at, is_blocked, is_inactivated, expert_status
            FROM knock.expert
            INNER JOIN (SELECT expert_index, expert_type FROM knock.expert_type INNER JOIN knock.have_expert_type ON expert_type = $1 AND have_expert_type.expert_type_index = expert_type.expert_type_index) AS type
            ON ${category} LIKE $2 
            AND type.expert_index = expert.expert_index 
            AND created_at BETWEEN $3 AND $4
            LIMIT 10 OFFSET $5;
            `
        ,[expertType, searchWord, startDate, endDate, pageCount]);
        return res.status(200).send({
            totalPageCount : Math.floor((result.rowCount/10))+1,
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
    const pageCount = (req.params.pageCount-1) * 10 || 0;
    const pg = new postgres();
    let searchWordCondition = null;
    let counseligTypeCondtion = '';

    try{
        await parameter.nullCheck(searchWord, counselingType, counselingStatus, searchCategory, startDate, endDate, pageCount);
        if(searchCategory == "닉네임")
            searchWordCondition = "user_index = (SELECT user_index FROM knock.users WHERE nickname LIKE $1)"
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
                INNER JOIN knock.have_expert_type ON have_expert_type.expert_index = psychology_payment.expert_index AND have_expert_type.expert_type_index = expert_type.expert_type_index), counseling_type, status AS payment_status, counseling_status, counseling_start_time
            FROM knock.payment_info
            INNER JOIN knock.psychology_payment
            ON ${searchWordCondition}
            AND counseling_status = $2 
            AND counseling_type IN (${counseligTypeCondtion})
            AND counseling_start_time BETWEEN $3 AND $4
            AND payment_info.payment_key = psychology_payment.payment_key
            AND status != 'WAITING_FOR_DEPOSIT'
            LIMIT 10 OFFSET $5;
            `
        ,[searchWord, counselingStatus, startDate, endDate, pageCount]);

        return res.status(200).send({
            totalPageCount : Math.floor((result.rowCount/10))+1,
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
    const pageCount = (req.params.pageCount-1) * 10 || 0;
    const pg = new postgres();
    let searchWordCondition = null;

    // 결제완료된 것만 불러와야함
    try{
        await parameter.nullCheck(searchWord, searchCategory, counselingStatus, startDate, endDate, pageCount);
        if(searchCategory == "결제상품번호")
            searchWordCondition = "user_index = (SELECT user_index FROM knock.users WHERE nickname LIKE $1)"
        else if(searchCategory == "전문가")
            searchWordCondition = "expert_index = (SELECT expert_index FROM knock.expert WHERE name LIKE $1)"

        await pg.connect(); 
        const result = await pg.queryExecute(
            `
            SELECT payment_info.payment_key, (SELECT user_index AS user_id, nickname FROM knock.users WHERE user_index = payment_info.user_index), status AS payment_status, counseling_status, counseling_start_time
            FROM knock.payment_info
            INNER JOIN knock.psychology_payment
            ON ${searchWordCondition}
            AND counseling_status = $2 
            AND counseling_start_time BETWEEN $3 AND $4
            AND payment_info.payment_key = psychology_payment.payment_key
            AND status != 'WAITING_FOR_DEPOSIT'
            LIMIT 10 OFFSET $5;
            `
        ,[searchWord, counselingStatus, startDate, endDate, pageCount]);

        return res.status(200).send({
            totalPageCount : Math.floor((result.rowCount/10))+1,
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