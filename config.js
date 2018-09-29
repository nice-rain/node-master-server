'use strict'

exports.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost/master-server';
exports.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'mongodb://localhost/test-master-server';
module.exports.PORT = process.env.PORT || 8082; //server port we are listening on