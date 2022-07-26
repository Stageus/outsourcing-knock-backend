const jwt = require("jsonwebtoken");
const tokenUtil = require('../utils/jwtToken');
const parameter = require('../utils/parameter');
const {NullParameterError, TokenExpiredError} = require('../errors/error');

module.exports.verifyToken = async(req, res, next) =>{
    try{
        const userId = req.body.userId || req.params.userid;
        const token = tokenUtil.parseToken(req.headers.authorization);
        await parameter.nullCheck(userId, token);

        req.decoded = await jwt.verify(token, process.env.TOKEN_SECRETKEY); // 토큰이 유효한지 체크합니다.
    
        if(userId != tokenUtil.openToken(token).id) // API 요청을 한 사용자의 id와 토큰에 들어있는 id가 다른지 체크합니다.
            return res.status(401).send();          // 다르다면 401번 응답을 보냅니다.
    
        next();
    }
    catch (err) {
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if (err.name ="TokenExpiredError") {   // 토큰이 만료됐습니다.
            return res.status(419).send();
        }
        else{
            return res.status(401).send();
        }
    }
};

module.exports.verifyAdminToken = async(req, res, next) =>{
    try{
        const token = tokenUtil.parseToken(req.headers.authorization);
        await parameter.nullCheck(token);
        req.decoded = await jwt.verify(token, process.env.ADMIN_TOKEN_SECRETKEY); // 토큰이 유효한지 체크합니다.
    
        next();
    }
    catch (err) {
        
        if(err instanceof NullParameterError)
            return res.status(400).send();

        if (err.name ="TokenExpiredError") {   // 토큰이 만료됐습니다.
            return res.status(419).send();
        }
        else{
            return res.status(401).send();
        }
    }
};
