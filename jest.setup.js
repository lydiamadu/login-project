const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const connect = async () => {
    const uri = fs.readFileSync(path.join(__dirname, '.test-mongo-uri'), 'utf8');
    process.env.JWT_SECRET = 'test-secret-key';
    await mongoose.connect(uri);
};

const disconnect = async () => {
    await mongoose.disconnect();
};

const clear = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
};

module.exports = { connect, disconnect, clear };
