const postgres = require('../database/pg');
const mongodb = require("../database/MongoDB");
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, CreatedHashedPaswordError} = require('../errors/error');

// 정산내역 조회
module.exports.getCalculationDetail = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const pageCount = req.params.pageCount;
    const pagePerRow = 5;

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            SELECT payment_key, PI.user_index, 
            (SELECT nickname FROM knock.users WHERE user_index = PI.user_index),
            (SELECT 
                CASE WHEN EXISTS(SELECT payment_key FROM knock.psychology_payment WHERE payment_key = $1) 
                    THEN '전문가 상담'
                ELSE '심리검사'
                END
            FROM knock.payment_info),
            price,
            payment_date
            FROM knock.payment_info AS PI
            WHERE payment_key = $1
            OFFSET ${pagePerRow * (pageCount-1)} LIMIT ${pagePerRow * pageCount};
            `
        , [expertId]);

        if(result.rowCount == 0){
            return res.status(400).send('해당하는 결과가 없습니다.');
        }
        return res.status(200).send({
            counseling : result.rows
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

// 정산계좌 등록 / 수정
module.exports.updateAccount = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;
    const bank = req.body.bank;
    const accountNumber = req.body.accountNumber;
    const accountHolder = req.body.accountHolder;
    const accountMemo = req.body.accountMemo;

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            UPDATE knock.expert
            SET bank = $2, account_number = $3, account_holder = $4, account_memo = $5
            WHERE expert_index = $1;
            `
        , [expertId, bank, accountNumber, accountHolder, accountMemo]);

        if(result.rowCount == 0){
            return res.status(400).send('해당하는 결과가 없습니다.');
        }
        return res.status(200).send({
            counseling : result.rows
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