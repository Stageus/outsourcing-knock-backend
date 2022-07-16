module.exports.getDate = () =>{
    const now  = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth()+1).toString();
    const day = now.getDate().toString();

    return (year.substring(2) + month.padStart(2,'0') + day.padStart(2,'0'));
}