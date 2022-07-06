
/* 
토큰 검사하는 부분에 요청을 보낸 사람이 진짜 토큰 주인인지를 테스트하는 부분도 필요할 것 같아요
*/
module.exports.verifyToken = (req, res, next) =>{
    const resultObj = {
        status : 'false', // status value : valid | expired | invalid
        message : '',
    };

    try{
        req.decoded = jwt.verify(req.headers.auth, secretKey);     
        next();
    }
    catch (err) {
        if (err === TokenExpiredError) {
            resultObj.status = 'expired';
            resultObj.message = 'token expired';

            return res.status(419).send(resultObj);
        }
        else{
            resultObj.status = 'invalid';
            resultObj.status = 'token is invalid';

            return res.status(401).send(resultObj);
        }
    }
};