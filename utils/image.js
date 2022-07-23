const sharp = require('sharp');
const {v4} = require('uuid');
const path = require('path');


module.exports.getFileName = async() =>{
    const token = v4().split;
    return token[2] + token[1] + token[0] + token[3] + token[4];
}


module.exports.resizingImage = async(buffer) =>{
    try{
    await sharp(buffer)
        .resize(300,300,{
            fit: sharp.fit.inside,
            withoutEnlargement: true
        })
        .withMetadata()
        .toFile(path.join(__dirname, `../images/banners/sibal${getFileName()}`));
    }
    catch(err){
        console.log(err);
    }
}