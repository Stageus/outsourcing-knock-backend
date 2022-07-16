const dateUtil = require('../utils/date');
const parameter = require('../utils/parameter');
const {RedisConnectionError, RedisError, NullParameterError} = require('../errors/error');
const Redis = require('../database/redis');


// 카드결제 불러오기
module.exports.getcardPaymentForm = async(req,res) =>{
    const price = req.body.price || 200000;
    const productName = req.body.productName || "테스트상품";
    const userId = req.params.userid || '유저id';
    const redis = new Redis();
    const date = dateUtil.getDate();
    if(productName =="채팅상담")
        productTag = "C"
    else if(productName == "음성상담")
        productTag = "V"
    else  // 심리검사
        productTag = "T"

    try{
        await parameter.nullCheck(price, productName, userId, productTag);
        await redis.connect();
        const productSequence = await redis.getProductSequence();
        await redis.setPrice((productTag+date+productSequence.toString().padStart(5,'0')),price);

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
                    var tossPayments = TossPayments(clientKey) // 클라이언트 키로 초기화하기
                </script>
            </body>
            <script>
            window.onload = tossPayments.requestPayment('카드', {
                // 결제 수단 파라미터
                // 결제 정보 파라미터
                amount: ${price},
                orderId: '${productTag}${date}${productSequence.toString().padStart(5,'0')}',
                orderName: '${productName}',
                customerName: '${userId}',
                successUrl: 'http://54.180.79.110:4000/success',
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
    const redis = new Redis();
    let tmp = null;
    try{
        await redis.connect();
        const savedPrice = await redis.getPrice(orderId);
        await redis.delete(orderId);
        if(price != savedPrice)
            return res.status(400).send("값이 조작됐습니다.");

        const http = require("https");

        const options = {
            "method": "POST",
            "hostname": "api.tosspayments.com",
            "port": null,
            "path": "/v1/payments/confirm",
            "headers": {
            "Authorization": "Basic dGVzdF9za19qWjYxSk94UlFWRW1hYnk2RUFEVlcwWDliQXF3Og==",
            "Content-Type": "application/json"
            }
        };
        
        const request = await http.request(options, function (response) {
            const chunks = [];
        
            response.on("data", function (chunk) {
            chunks.push(chunk);
            //console.log(chunk);
            //console.log(chunks.toString());
            });
        
            response.on("end", function () {
            tmp = Buffer.concat(chunks);
            //console.log(chunks);
            //console.log(tmp);
            return res.send({
                message : "결제됐다 ㅅㅂ..",
                payment : tmp.toString()});
            });
        });
        
        await request.write(JSON.stringify({
            paymentKey: paymentKey,
            amount: price,
            orderId: orderId
        }));
        await request.end();
    }
    catch(err){
        console.log(err);
    }
    finally{
        await redis.disconnect();
    }
}