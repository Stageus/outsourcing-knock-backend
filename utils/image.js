const sharp = require('sharp');
const {v4} = require('uuid');


module.exports.getUUID = async() =>{
    const token = v4().split;
    return token[2] + token[1] + token[0] + token[3] + token[4];
}
