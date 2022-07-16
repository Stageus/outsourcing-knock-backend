const schedule = require('node-schedule');
const Redis = require('../database/redis');

schedule.scheduleJob('* * 0 * * *', async()=>{
    const redis = new Redis();
        try{
            await redis.connect();
            await redis.client.set('productSequence', '1');
        }
        catch(err){
            console.log(err);
        }
        finally{
            await redis.disconnect();
        }
});