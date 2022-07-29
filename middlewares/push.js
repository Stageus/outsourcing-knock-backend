const CryptoJS = require("crypto-js");
const axios = require("axios");
const Redis = require("../database/redis");
const parameter = require("../utils/parameter");
const { RedisConnectionError, RedisError, NullParameterError, SqlSyntaxError } = require('../errors/error');

module.exports.registerDeviceToken = async (req, res) => {
    const userIndex = req.params.userid;
    const deviceToken = req.body.deviceToken;

    const date = Date.now().toString();
    const uri = process.env.NCP_PUSH_SERVICE_ID; //서비스 ID
    const secretKey = process.env.NCP_SECRET_KEY; // Secret Key
    const accessKey = process.env.NCP_KEY; //Access Key
    const method = "POST";
    const space = " ";
    const newLine = "\n";
    const url = `https://sens.apigw.ntruss.com/push/v2/services/${uri}/users`;
    const url2 = `/push/v2/services/${uri}/users`;
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
        const result = await axios.post(
            url,
            {
                userId: userIndex,
                deviceType: "GCM",
                deviceToken: deviceToken,
                isNotificationAgreement: true,
                isAdAgreement: true,
                isNightAdAgreement: true
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

        if (result.status == 201)
            console.log('Token Register Success');
        return res.status(200).send();
    } catch (err) {
        console.log(err);
        if (err instanceof NullParameterError) return res.status(400).send();
        if (err instanceof RedisConnectionError) return res.status(500).send();
        if (err instanceof RedisError) return res.status(500).send();

        return res.status(500).send(err);
    }
};

module.exports.pushAlarm = async (req, res) => {
    const userIndex = req.params.userid;

    const date = Date.now().toString();
    const uri = process.env.NCP_PUSH_SERVICE_ID; //서비스 ID
    const secretKey = process.env.NCP_SECRET_KEY; // Secret Key
    const accessKey = process.env.NCP_KEY; //Access Key
    const method = "POST";
    const space = " ";
    const newLine = "\n";
    const url = `https://sens.apigw.ntruss.com/push/v2/services/${uri}/messages`;
    const url2 = `/push/v2/services/${uri}/messages`;
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
        const result = await axios.post(
            url,
            {
                messageType: "NOTIF",
                target: {
                    type: "USER",
                    deviceType: "GCM",
                    to: [
                        userIndex
                    ],
                },
                message: {
                    default: {
                        content: "마음연구소 knock push알림입니다.",
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

        if (result.status == 202) {
            console.log('Success Push Alarm');
        }
        return res.status(200).send();
    } catch (err) {
        console.log(err);
        if (err instanceof NullParameterError) return res.status(400).send();
        if (err instanceof RedisConnectionError) return res.status(500).send();
        if (err instanceof RedisError) return res.status(500).send();

        return res.status(500).send(err);
    }
};

module.exports.getToken = async (req, res) => {
    const userIndex = req.params.userid;

    const date = Date.now().toString();
    const uri = process.env.NCP_PUSH_SERVICE_ID; //서비스 ID
    const secretKey = process.env.NCP_SECRET_KEY; // Secret Key
    const accessKey = process.env.NCP_KEY; //Access Key
    const method = "GET";
    const space = " ";
    const newLine = "\n";
    const url = `https://sens.apigw.ntruss.com/push/v2/services/${uri}/users/${userIndex}`;
    const url2 = `/push/v2/services/${uri}/users/${userIndex}`;
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
        const result = await axios.get(
            url,
            {
                headers: {
                    "Contenc-type": "application/json; charset=utf-8",
                    "x-ncp-iam-access-key": accessKey,
                    "x-ncp-apigw-timestamp": date,
                    "x-ncp-apigw-signature-v2": signature,
                },
            }
        );

        if (result.status == 200) {
            console.log(result.data.devices);
        }
        return res.status(200).send();
    } catch (err) {
        console.log(err);
        if (err instanceof NullParameterError) return res.status(400).send();
        if (err instanceof RedisConnectionError) return res.status(500).send();
        if (err instanceof RedisError) return res.status(500).send();

        return res.status(500).send(err);
    }
};