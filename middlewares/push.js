const CryptoJS = require("crypto-js");
const axios = require("axios");
const Redis = require("../database/redis");
const parameter = require("../utils/parameter")
const {RedisConnectionError, RedisError, NullParameterError, SqlSyntaxError} = require('../errors/error');

module.exports.pushAlarm = async (req, res) => {
    const messageContent = `마음연구소 knock 전문가 휴대폰 인증 메일입니다.`;
  
    const date = Date.now().toString();
    const uri = process.env.NCP_SERVICE_ID; //서비스 ID
    const secretKey = process.env.NCP_SECRET_KEY; // Secret Key
    const accessKey = process.env.NCP_KEY; //Access Key
    const method = "POST";
    const space = " ";
    const newLine = "\n";
    const url = `https://sens.apigw.ntruss.com/push/v2/services/${uri}/users`;
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
    try {
      await axios.post(
        url,
        {
          messageType: "NOTIF",
          target: {
            type: "ALL", // use USER later
            deviceType: null,
            to: ["ALL"],
            country: ["410", "KOR", "KO"],
          },
          message: {
            default: {
              content: "테스트 푸시알림입니다.",
              custom: {
                customKey1: "customValue1",
                customKey2: "customValue2",
              },
            },
          },
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

      return res.status(200).send();
    } catch (err) {
      if (err instanceof NullParameterError) return res.status(400).send();
      if (err instanceof RedisConnectionError) return res.status(500).send();
      if (err instanceof RedisError) return res.status(500).send();

      return res.status(500).send(err);
    }
  };