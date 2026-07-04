const path = require('path');
const fs = require('fs');

module.exports = async () => {
    if (globalThis.__MONGOD__) {
        await globalThis.__MONGOD__.stop();
    }
    const uriFile = path.join(__dirname, '.test-mongo-uri');
    if (fs.existsSync(uriFile)) fs.unlinkSync(uriFile);
};
