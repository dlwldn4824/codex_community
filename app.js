const express = require("express");
const { handleRequest } = require("./runtime");

// Vercel은 Express 앱을 production 서버리스 함수로 감지합니다.
// 실제 라우팅 로직은 localhost와 동일한 handleRequest를 그대로 사용합니다.
const app = express();
app.use((req, res) => handleRequest(req, res));

module.exports = app;
