const jwt = require("jsonwebtoken");
const dotenv = require('dotenv');
const path = require("path");
const { TokenExpiredError } = require("../errors/error.js"); // Get token error object
dotenv.config({path : path.join(__dirname, "../config/.env")});

const config = {
    secretKey : process.env.TOKEN_SECRETKEY,
}

module.exports.issueToken = async (reqId, reqPw) =>{
    const signedJwt = jwt.sign(
        { // payload
            id : reqId,
            pw : reqPw, 
        },
        config.secretKey,
        { // options
            expiresIn: "10m",
            issuer : "knock",
        }
    )

    return signedJwt;
};

module.exports.verifyToken = (req, res) =>{
    const resultObj = {
        status : 'false', // status value : valid | expired | invalid
        message : '',
    };

    try{
        req.decoded = jwt.verify(req.headers.auth, secretKey);
        resultObj.status = 'valid';
        resultObj.message = 'token check success';
        
        return res.status(200).send(resultObj);
    }
    catch (err) {
        if (err == TokenExpiredError) {
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

module.exports.openToken = (token) => {
    const base64Payload = token.split('.')[1];
    const payload = Buffer.from(base64Payload, 'base64');
    const result = JSON.parse(payload.toString());

    return result;
}