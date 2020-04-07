const CryptoJS = require("crypto-js");

// 和 worker.js 里配置相同的密码
const key = "123456";
// 替换为自己的 worker url
const worker_url = "https://name.my.workers.dev/";

// 计算 pickcode 参数
function pathEncryptToPickcode(path) {
  const data = {path, time: Date.now()};
  const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
  const pickcode = Buffer.from(ciphertext).toString('base64');
  return pickcode;
}

// 要请求的文件路径
const path = "movie/demo.mp4";

console.log(`path: ${path}
url: ${worker_url}${path}?pickcode=${pathEncryptToPickcode(path)}
`);
