
const jwt = require("jsonwebtoken");
const dotenv = require('dotenv');
const { TokenIssueError, } = require("../errors/error");
const path = require("path");
dotenv.config({path : path.join(__dirname, "../config/.env")});

const config = {
    secretKey : process.env.TOKEN_SECRETKEY,
}

module.exports.issueToken = async (reqId) =>{
    try{
        const signedJwt = jwt.sign(
            { // payload
                id : reqId, 
            },
            config.secretKey,
            { // options
                expiresIn: "100m",
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