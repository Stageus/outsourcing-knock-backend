const CryptoJS = require("crypto-js");
const axios = require("axios");
const Redis = require("../database/redis");
const parameter = require("../utils/parameter")
const {RedisConnectionError, RedisError, NullParameterError, SqlSyntaxError} = require('../errors/error');

// 휴대폰 인증번호 보내기
module.exports.sendCertifiedNumber = async (req, res) => {
  const phone = req.params.phone;
  const certifiedNumber = Math.random().toString(10).substring(2, 8);
  const messageContent = `마음연구소 knock 전문가 휴대폰 인증 메일입니다. \n 인증번호 : ${certifiedNumber}`;

  var user_phone_number = phone; //수신 전화번호 기입
  const date = Date.now().toString();
  const uri = process.env.NCP_SERVICE_ID; //서비스 ID
  const secretKey = process.env.NCP_SECRET_KEY; // Secret Key
  const accessKey = process.env.NCP_KEY; //Access Key
  const method = "POST";
  const space = " ";
  const newLine = "\n";
  const url = `https://sens.apigw.ntruss.com/sms/v2/services/${uri}/messages`;
  const url2 = `/sms/v2/services/${uri}/messages`;
  const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
  hmac.update(method);
  hmac.update(space);
  hmac.update(url2);
  hmac.update(newLine);
  hmac.update(date);
  hmac.update(newLine);
  hmac.update(accessKey);
  const hash = hmac.finalize();
  const signature = hash.toString(CryptoJS.enc.Base64);
  const redis = new Redis();
  try {
    await parameter.nullCheck(phone);
    await axios.post(
      url,
      {
        type: "SMS",
        countryCode: "82",
        from: process.env.SENT_PHONE_NUMBER, //"발신번호기입",
        content: messageContent, //문자내용 기입,
        messages: [{ to: `${user_phone_number}` }],
      },
      {
        headers: {
          "Contenc-type": "application/json; charset=utf-8",
          "x-ncp-iam-access-key": accessKey,
          "x-ncp-apigw-timestamp": date,
          "x-ncp-apigw-signature-v2": signature,
        },
      }
    );

    await redis.connect();
    await redis.setCertifiedNumber(phone, certifiedNumber);

    return res.status(200).send();
  } catch (err) {
    if(err instanceof NullParameterError)
        return res.status(400).send();

    if(err instanceof RedisConnectionError)
        return res.status(500).send();

    if(err instanceof RedisError)
        return res.status(500).send();

    return res.status(500).send();
  }
};

// 휴대폰 인증번호 검증
module.exports.phoneValidation = async (req, res) => {
  const phone = req.params.phone;
  const certifiedNumber = req.body.certifiedNumber;
  const redis = new Redis();
  const result = { message : null };
  try{
    await parameter.nullCheck(certifiedNumber);
    await redis.connect();
    const correctNumber = await redis.getCertifiedNumber(phone);
    const isExpired = (await redis.getTTL(phone) === -2);

    if(isExpired) {
      result.message = "Timeout";
      return res.status(408).send(result);
    }
    else if (certifiedNumber == correctNumber) {
      result.message = "Success";
      await redis.delete(phone);
      return res.status(200).send(result);
    } 
    else {
      result.message = "Failed";
      return res.status(401).send(result);
    }
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
};
