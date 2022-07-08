const crypto = require('crypto');
const salt = process.env.SALT;
const {CreatedHashedPaswordError} = require('../errors/error');


module.exports.createHashedPassword = async(password) =>{

    try{
        const hashedPassword = await crypto.createHash('sha256').update(password + salt).digest('hex')
        return hashedPassword;
    }
    catch(err){
        throw new CreatedHashedPaswordError(err);
    }

}