const postgres = require('../database/pg');
const mongodb = require("../database/MongoDB");
const parameter = require('../utils/parameter');
const {PostgreConnectionError, SqlSyntaxError, NullParameterError, CreatedHashedPaswordError} = require('../errors/error');

// 정산내역 조회
module.exports.getCalculationDetail = async(req,res)=>{
    const pg = new postgres();
    const expertId = req.params.expertId;

    try{
        await pg.connect();
        const result = await pg.queryExecute(
            `
            WITH payment_expert_index AS (
                SELECT payment_key, 
                    CASE WHEN EXISTS(SELECT payment_key FROM knock.psychology_payment WHERE payment_key = PI.payment_key)
                        THEN (SELECT expert_index FROM knock.psychology_payment WHERE payment_key = PI.payment_key)
                    ELSE (SELECT expert_index FROM knock.allotted_test WHERE payment_key = PI.payment_key)
                    END
                FROM knock.payment_info AS PI)
            
            SELECT PI.payment_key, PI.user_index, 
                (SELECT nickname FROM knock.users WHERE user_index = PI.user_index),
                (SELECT 
                        CASE WHEN EXISTS(SELECT payment_key FROM knock.psychology_payment WHERE payment_key = PI.payment_key)
                            THEN '전문가 상담'
                        ELSE '심리검사'
                        END
                    FROM knock.payment_info
                    WHERE payment_key = PI.payment_key) AS product_type,
                original_price AS price,
                payment_date
            FROM knock.payment_info AS PI
            JOIN payment_expert_index AS PEI ON PI.payment_key = PEI.payment_key
            WHERE expert_index = $1;
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
        await pg.queryUpdate(
            `
            UPDATE knock.expert
            SET bank = $2, account_number = $3, account_holder = $4, account_memo = $5
            WHERE expert_index = $1;
            `
        , [expertId, bank, accountNumber, accountHolder, accountMemo]);

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