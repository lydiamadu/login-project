const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');

module.exports = async () => {
    const mongod = await MongoMemoryServer.create();
    globalThis.__MONGOD__ = mongod;
    fs.writeFileSync(path.join(__dirname, '.test-mongo-uri'), mongod.getUri());
};
