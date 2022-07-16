const dateUtil = require('../utils/date');
const {RedisConnectionError, RedisError} = require('../errors/error');
const Redis = require('../database/redis');


// 카드결제 불러오기
module.exports.cardPayment = async(req,res) =>{

    const price = req.body.price || 1;
    const productName = req.body.productName || 2;
    const userId = req.params.userid || 3;
    const redis = new Redis();
    let productTag;
    if(productName =="채팅상담")
        productTag = "C"
    else if(productName == "음성상담")
        productTag = "V"
    else  // 심리검사
        productTag = "T"

    try{
        await redis.connect();
        const productNumber = await redis.getProductNumber();

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
                orderId: '${productTag}${dateUtil.getDate()}${productNumber.toString().padStart(5,'0')}',
                orderName: ${productName},
                customerName: ${userId},
                successUrl: 'http://localhost:8080/success',
                failUrl: 'http://localhost:8080/fail',
            })
            </script>
            `);

        res.end();
    }
    catch(err){
        //console.log(err);
        //console.log(err.name);
        //console.log(typeof err);
    }
    finally{
        //await redis.disconnect();
    }
}