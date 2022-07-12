const nodemailer = require('nodemailer');
const {SendMailError} = require('../errors/error');
module.exports.sendMail = async(message, receiverMailAddress)=>{
    const transporter = nodemailer.createTransport({
        service : 'naver',
        host : 'smtp.naver.com',
        port : 465,
        secure : false,
        auth :{
            user: process.env.MAILER_USER,
            pass : process.env.MAILER_PASSWORD
        }
    });

    try{
        await transporter.sendMail({
            from : process.env.MAILER_EMAIL,
            to : receiverMailAddress,
            subject : `knock 임시 비밀번호입니다.`,
            text : 
            `
            다음 비밀번호로 로그인 하세요.\n
            ${message}
            `
        })
    }
    catch(err){
        throw new SendMailError();
    }
}

module.exports.sendAuthenticationMail = async(userId, receiverMailAddress)=>{
    const transporter = nodemailer.createTransport({
        service : 'naver',
        host : 'smtp.naver.com',
        port : 465,
        secure : false,
        auth :{
            user: process.env.MAILER_USER,
            pass : process.env.MAILER_PASSWORD
        }
    });

    try{
        await transporter.sendMail({
            from : process.env.MAILER_EMAIL,
            to : receiverMailAddress,
            subject : `knock 이메일 인증`,
            html : 
            `<a href="http://54.180.79.110:4000/users/${userId}/email-authentication">여기를 클릭하시면 이메일이 인증됩니다.</a>`
        })
    }
    catch(err){
        throw new SendMailError();
    }
}