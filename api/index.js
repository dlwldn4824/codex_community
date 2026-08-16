// Vercel Serverless Function entrypoint.
// The same request handler is used by localhost and production deployment.
module.exports = require("../server").handleRequest;
