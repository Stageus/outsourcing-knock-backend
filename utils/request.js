const {NullExceptionError} = require('../errors/error');

module.exports.nullCheck = async(...arg) =>{
    arg.forEach((value =>{
        if(value == "" || value == null || value == undefined || ( value != null && typeof value == "object" && !Object.keys(value).length))
            throw  new NullExceptionError();
    }))
}