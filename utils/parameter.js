const {NullParameterError} = require('../errors/error');
const {v4} = require('uuid');

module.exports.nullCheck = async(...arg) =>{
    if(arg.length === 0 )
        throw new NullParameterError();

    arg.forEach((value =>{
        if(value === "" || value === null || value === undefined || ( value !== null && typeof value === "object" && !Object.keys(value).length)){
            throw  new NullParameterError();
        }
    }))

}

module.exports.getAffiliateCode = async() =>{
    const token = v4().split('-');
    return token[2] + token[1] + token[0] + token[4];
}