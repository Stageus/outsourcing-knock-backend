// (array) ['a', 'b', 'c'] => (string) " 'a','b','c' "
module.exports.convertArrayFormat = (value) => {
    let result = "";
    for(let i of value){
        result += (`'${i}', `);
    }
    result = result.slice(0,-2);
    return result;
}