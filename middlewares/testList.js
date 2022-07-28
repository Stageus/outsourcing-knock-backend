const postgres = require('../database/pg');
const mongodb = require("../database/MongoDB");
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, CreatedHashedPaswordError} = require('../errors/error');
const hasing = require('../utils/password');
const jwtToken = require('../utils/jwtToken');
const array2String = require('../utils/array2String');

// 검사 목록 - 배정 목록 : 가져오기
module.exports.getAllocationList = async(req,res)=>{
    const pg = new postgres();

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT TP.payment_key AS product_key, TP.user_index, nickname, 'MSHQ검사' AS test_name, testing_date AS date
            FROM knock.test_payment AS TP
            JOIN knock.users AS U ON TP.user_index = U.user_index
            JOIN knock.test_result AS TR ON TP.payment_key = TR.payment_key
            `
        , []);

        const count = await pg.queryExecute(
            `
            SELECT CEIL(COUNT(*) / 10.0)
            FROM knock.test_payment
            `
        );

        return res.status(200).send({
            testList : result.rows,
            pageCount : count.rowCount,
        });
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

// 검사 목록 - 배정 목록 : 검사결과지 보기
// 검사 결과 포맷에 맞추어 개발
module.exports.viewResult = async(req,res)=>{ 
    const pg = new postgres();
    const productIndex = req.params.productIndex;

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            `
        , []);

        return res.status(200).send(result.rows);
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

// 검사 목록 - 배정 목록 : 배정 받기
module.exports.allot = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const productIndex = req.body.productIndex;

    try{
        parameter.nullCheck(productIndex);
        await pg.connect();
        await pg.queryUpdate(
            `
            INSERT INTO knock.allotted_test VALUES($1, $2, null);
            `
        , [expertId, productIndex]);

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

// 검사 목록 - 해석 상담 목록 : 가져오기
module.exports.getCounselingList = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const searchType = req.params.searchType;
    const description = req.params.description;
    const progress = req.params.progress;
    const cancelStatus = req.params.cancelStatus;
    const startDate = req.params.startDate;
    const endDate = req.params.endDate;

    let whereClause = ``;
    whereClause = `WHERE AT.expert_index = ${expertId} `;
    try{
        // make where clause
        if(searchType != "empty" && description != "empty"){
            if(whereClause != ""){ whereClause += "AND "; }
            if(searchType === "결제상품번호"){
                whereClause += `AT.payment_key = ${description} `;
            }
            else if(searchType === "회원번호"){
                whereClause += `TP.user_index = ${description} `;
            }
            else if(searchType === "닉네임"){
                whereClause += `nickname = '${description}' `;
            }
        }

        if(progress != "empty"){
            if(whereClause != ""){ whereClause += "AND "; }
            whereClause += `counseling_status = '${progress}' `;
        }
        if(cancelStatus != "empty"){
            if(cancelStatus != "CANCEL" && cancelStatus != "REFUND"){
                throw SqlSyntaxError;
            }
            if(whereClause != ""){ whereClause += "AND "; }
            whereClause += `status = '${cancelStatus}' `;
        }
        if(startDate != "empty" && endDate != "empty"){
            if(whereClause != ""){ whereClause += "AND "; }
            whereClause += `'${startDate}'::date <= consultation_time::date AND consultation_time::date <= '${endDate}'`;
        }
    
        console.log(whereClause);
    }
    catch(err){
        if(err instanceof SqlSyntaxError)
            return res.status(409).send();
    }
    
    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT AT.payment_key AS product_key, TP.user_index, nickname AS user_nickname, counseling_status, status, counseling_start_time, counseling_end_time
            FROM knock.allotted_test AS AT
            JOIN knock.test_payment AS TP ON AT.payment_key = TP.payment_key
            JOIN knock.users AS U ON TP.user_index = U.user_index
            JOIN knock.payment_info AS PI ON AT.payment_key = PI.payment_key
            ${whereClause}
            `
        , []);

        const count = await pg.queryExecute(
            `
            SELECT CEIL(COUNT(*) / 10.0)
            FROM knock.allotted_test AS AT
            JOIN knock.test_payment AS TP ON AT.payment_key = TP.payment_key
            JOIN knock.users AS U ON TP.user_index = U.user_index
            JOIN knock.payment_info AS PI ON AT.payment_key = PI.payment_key
            ${whereClause}
            `
        );

        return res.status(200).send({
            counselingList : result.rows,
            pageCount : count.rowCount,
        });
    }
    catch(err){
        console.log(err);
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

// 검사 목록 - 해석 상담 목록 : 상세보기
module.exports.getCounseling = async(req,res)=>{
    const pg = new postgres();
    const productId = req.params.productId;

    try{
        parameter.nullCheck(productId);
        await pg.connect();

        const result = await pg.queryExecute(
            `
            SELECT AT.payment_key AS product_key, TP.user_index, nickname AS user_nickname, E.name AS expert_name, counseling_start_time, counseling_end_time, status, counseling_status,
            (SELECT EXISTS(SELECT * FROM knock.expert_review WHERE payment_key = AT.payment_key)) AS review,
            (SELECT EXISTS(SELECT * FROM knock.test_result WHERE payment_key = AT.payment_key)) AS test_result
            FROM knock.allotted_test AS AT
            JOIN knock.test_payment AS TP ON AT.payment_key = TP.payment_key
            JOIN knock.payment_info AS PI ON AT.payment_key = PI.payment_key
            JOIN knock.expert AS E ON AT.expert_index = E.expert_index
            JOIN knock.users AS U ON TP.user_index = U.user_index
            WHERE AT.payment_key = $1;
            `
        , [productId]);

        if(result.rowCount == 0){
            res.status(400).send("해당하는 정보가 없습니다.");
        }

        return res.status(200).send(result.rows[0]);
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

// 검사 목록 - 해석 상담 목록 : 배정취소
module.exports.cancelCounseling = async(req,res)=>{
    const pg = new postgres();
    const productId = req.params.productId;

    try{
        parameter.nullCheck(productId);
        await pg.connect();

        await pg.queryUpdate(
            `
            DELETE FROM knock.allotted_test
            WHERE payment_key = $1;
            `
        , [productId]);

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

// 검사 목록 - 해석 상담 목록 : 상세 변경사항 저장하기
module.exports.updateCounseling = async(req,res)=>{
    const pg = new postgres();
    const productId = req.params.productId;
    const startTime = req.body.start_time;
    const endTime = req.body.end_time;

    try{
        parameter.nullCheck(productId, startTime, endTime);
        await pg.connect();

        await pg.queryUpdate(
            `
            UPDATE knock.allotted_test 
            SET counseling_start_time = $2, counseling_end_time = $3
            WHERE payment_key = $1;
            `
        , [productId, startTime, endTime]);

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

// 검사 목록 - 해석 상담 목록 : 사용자에게 결과 오픈하기
module.exports.openCounselingResult = async(req,res)=>{
    const pg = new postgres();
    const productId = req.params.productId;

    try{
        parameter.nullCheck(productId);
        await pg.connect();

        await pg.queryUpdate(
            `
            UPDATE knock.test_result
            SET is_opened = true
            WHERE payment_key = $1;
            `
        , [productId]);

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

// 검사 목록 - 해석 상담 목록 : 후기 보기
module.exports.getReview = async(req,res)=>{
    const pg = new postgres();
    const productId = req.params.productId;

    try{
        await pg.connect();

        const result = await pg.queryExecute(
            `
            SELECT reviews, writed_at FROM knock.expert_review 
            WHERE payment_key = $1;
            `
        , [productId]);

        if(result.rowCount == 0){
            return res.status(400).send('해당하는 결과가 없습니다.');
        }
        return res.status(200).send(result.rows[0]);
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