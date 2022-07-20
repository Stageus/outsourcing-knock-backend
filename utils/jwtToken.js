
const jwt = require("jsonwebtoken");
const dotenv = require('dotenv');
const { TokenIssueError, } = require("../errors/error");
const path = require("path");
dotenv.config({path : path.join(__dirname, "../config/.env")});

const config = {
    secretKey : process.env.TOKEN_SECRETKEY,
    adminSecretKey : process.env.ADMIN_TOKEN_SECRETKEY
}

module.exports.issueToken = async (reqId, expire = "100m") =>{
    try{
        const signedJwt = jwt.sign(
            { // payload
                id : reqId, 
            },
            config.secretKey,
            { // options
                expiresIn: expire,
                issuer : "knock",
            }
        )
        return signedJwt;
    }
    catch(err){
        throw new TokenIssueError(err);
    }
};

module.exports.issueAdminToken = async (reqId, expire = "100m") =>{
    try{
        const signedJwt = jwt.sign(
            { // payload
                id : reqId, 
            },
            config.adminSecretKey,
            { // options
                expiresIn: expire,
                issuer : "knock",
            }
        )
        return signedJwt;
    }
    catch(err){
        throw new TokenIssueError(err);
    }
};

module.exports.openToken = (token) => {
    const base64Payload = token.split('.')[1];
    const payload = Buffer.from(base64Payload, 'base64');
    const result = JSON.parse(payload.toString());
    
    return result;
}

module.exports.parseToken = (token) =>{
    return token.split(" ")[1];
}