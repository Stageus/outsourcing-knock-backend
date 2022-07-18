const dateUtil = require('../utils/date');
const parameter = require('../utils/parameter');
const {RedisConnectionError, RedisError, NullParameterError, SqlSyntaxError} = require('../errors/error');
const Redis = require('../database/redis');
const postgres = require('../database/pg');
const axios = require('axios');

// 카드결제 불러오기
module.exports.getPaymentForm = async(req,res) =>{
    const originalAmount = req.body.originalAmount || 200000;
    const paymentAmount = req.body.paymentAmount || 200000;
    const productName = req.body.productName || "채팅";
    const userId = req.params.userId || '2';
    const method = req.body.method || '카드';
    const couponid = req.body.couponId || 2;
    const expertId= req.body.expertId || 8;
    const date = dateUtil.getDate();
    const redis = new Redis();
    if(productName ==="채팅")
        productTag = "C"
    else if(productName === "음성")
        productTag = "V"
    else if(productName === "검사")
        productTag = "T"

    productTag="t";

    /* 상담일 경우 전문가 인덱스값이 필요하다. 심리검사의 경우에는 필요없음 */
    /* originalAmount와 paymentAmount가 다를 경우(즉 할인 받은 경우)에는 쿠폰이 null인지도 체크해야함 */
    /* 필수로 null 체크해야하는 변수들 
    originalAmount
    paymentAmount
    productName
    userId
    method
    date
    */
    try{
        await parameter.nullCheck(originalAmount, paymentAmount, productName, userId, method, date);

        if(originalAmount != paymentAmount) // 할인이 됐다면
            await parameter.nullCheck(couponid);  // 쿠폰이 사용됐는지 체크

        if(productName != "검사")    // 결제한 상품이 상담이라면
            await parameter.nullCheck(expertId) // 전문가 id가 넘어왔는지 체크

        await redis.connect();    
        const productSequence = await redis.getProductSequence();
        await redis.setPrice((productTag+date+productSequence.toString().padStart(5,'0')), paymentAmount);

        res.writeHead(200,{'Content-type' : 'text/html; charset=utf-8'});
        res.write(
            `
            <head>
            <title>결제하기</title>
            <script src="https://js.tosspayments.com/v1"></script>
            </head>
            <body>
                <script>
                    var clientKey = 'test_ck_0Poxy1XQL8Rbx1a2WJY87nO5Wmlg'
                    var tossPayments = TossPayments(clientKey)
                </script>
            </body>
            <script>
            window.onload = tossPayments.requestPayment('${method}', {
                amount: ${paymentAmount},
                orderId: '${productTag}${date}${productSequence.toString().padStart(5,'0')}',
                orderName: '${productName}',
                customerName: '${userId}',
                successUrl: 'http://54.180.79.110:4000/payment-success?couponid=${couponid}&userid=${userId}&expertid=${expertId}&productName=${productName}',
                failUrl: 'http://54.180.79.110:4000/fail',
            })
            </script>
            `);
        res.end();
    }
    catch(err){
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if(err instanceof RedisConnectionError)
            return res.status(500).send();

        if(err instanceof RedisError)
            return res.status(500).send();

        return res.status(500).send();
    }
    finally{
        await redis.disconnect();
    }
}

module.exports.approvalCardPayment = async(req,res)=>{
    const paymentKey = req.query.paymentKey;
    const orderId = req.query.orderId;
    const price = req.query.amount;
    const couponId = req.query.counponid;
    const userId = req.query.userid;
    const expertId = req.query.expertid;
    let result = null;
    let counseling_type = req.query.productName;
    if(counseling_type === "검사")
        counseling_type = "NULL";

    
    const redis = new Redis();
    const pg = new postgres();

    try{
        await redis.connect();
        await pg.connect();
        const savedPrice = await redis.getPrice(orderId);
        await redis.delete(orderId);
        if(price != savedPrice)
            return res.status(400).send("실제 결제 해야할 금액과 결제할 금액이 다릅니다.");

        result = await axios.post('https://api.tosspayments.com/v1/payments/confirm', {
            paymentKey: paymentKey,
            amount: price,
            orderId: orderId
        }, {
            headers : {
                "Authorization": "Basic dGVzdF9za19qWjYxSk94UlFWRW1hYnk2RUFEVlcwWDliQXF3Og==",
                "Content-Type": "application/json"
            }
        });

        if(result.status == 200){
            await pg.queryExecute('BEGIN;',[]);
                await pg.queryUpdate(
                    `
                    INSERT INTO knock.payment_info (payment_key, order_id, status, price, payment_method, payment_date, counseling_type)
                    VALUES($1, $2, $3, $4, $5, $6, $7);
                    `
                ,[result.data.paymentKey, result.data.orderId, result.data.status, result.data.totalAmount, result.data.method, result.data.approvedAt, counseling_type]);
                
                // 심리검사에 대한 결제라면
                if(counseling_type === "NULL"){
                    await pg.queryUpdate(
                        `
                        INSERT INTO knock.test_payment (payment_key, user_index, expiration_date)
                        VALUES($1, $2, (NOW()+ Interval '14 days'));
                        `
                    ,[result.data.paymentKey, userId]);
                }
                else{
                    await pg.queryUpdate(
                        `
                        INSERT INTO knock.psychology_payment (payment_key, user_index, expert_index)
                        VALUES($1, $2, $3);
                        `
                    ,[result.data.paymentKey, userId, expertId]);
                }

                if(couponId != undefined){
                    await pg.queryUpdate(
                        `
                        UPDATE knock.have_coupon 
                        SET payment_key = $1
                        WHERE user_index = $2 AND coupon_index $3;
                        `
                    ,[result.data.paymentKey, userId, couponId])
                }

                await pg.queryExecute('COMMIT;',[]);
                if(result.data.method == "카드"){
                    return res.status(200).send({
                        method : "카드",
                        orderId : result.data.orderId,
                        totalAmount : result.data.totalAmount
                    });
                }
                else{
                    return res.status(200).send({
                        method : "가상계좌",
                        orderId : result.data.orderId,
                        accountNumber : result.data.virtualAccount.accountNumber,
                        totalAmount : result.data.totalAmount,
                        bank : result.data.virtualAccount.bank,
                    })
                }
        }
        else{
            // 결제승인이 되지 않은 경우
            return res.status(500).send();
        }
    }
    catch(err){
        if(err instanceof SqlSyntaxError){ // 결제승인은 성공했으나 결제정보를 DB넣다가 에러가 발생한 경우. 
            await pg.queryExecute('ROLLBACK;',[]);
            if(result.data.method == "카드") //paymentKey 값으로 승인된 결제를 취소한다.
                await axios.post(`https://api.tosspayments.com/v1/payments/${result.data.paymentKey}/cancel`,
                {
                    cancelReason : "자사 DB 삽입 중 오류발생"
                }, 
                {
                    headers : {
                        "Authorization": "Basic dGVzdF9za19qWjYxSk94UlFWRW1hYnk2RUFEVlcwWDliQXF3Og==",
                        "Content-Type": "application/json"
                    }
                })
            return res.status(500).send();
        }
        if(err instanceof RedisConnectionError)
            return res.status(500).send();

        if(err instanceof RedisError)
            return res.status(500).send();

        return res.status(500).send();
    }
    finally{
        await redis.disconnect();
        await pg.disconnect();
    }
}


module.exports.getWebhook = async(req, res) =>{
    const pg = new postgres();
    // 가상계좌에 돈이 입금됐을 때나 입금이 취소됐을 때 호출됨.
    try{
        await pg.connect();
        await pg.queryUpdate(
            `
            UPDATE knock.payment_info
            SET status = $1, payment_date = $2
            WHERE order_id = $3;
            `
        ,[req.body.status, req.body.createdAt, req.body.orderId]);
    }
    catch(err){
        return res.status(404);
    }
    finally{
        await pg.disconnect();
    }
    return res.status(200).send();
}