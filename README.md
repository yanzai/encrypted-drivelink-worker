# encrypted-drivelink-worker
利用 Cloudflare Workers 为 Google Drive 文件提供 **加密直链** ，支持对文件路径和直链有效期进行验证后才返回  Drive 文件内容。

## 简介

利用 Cloudflare Workers 可以在不需要服务器的情况下为 Google Drive 文件提供直链下载和预览等功能。但是也容易导致直链被任意分发和滥用，我想让那些知道直链 url 的人，在未经授权的情况下，不能任意下载和获取内容。这就是这个项目的目的。



## 使用

### cloudflare worker 端配置

新建一个 Cloudflare Worker ，复制 worker.js 中的内容进去

修改配置：

```js
const config = {
  "client_id": "",
  "client_secret": "",
  "refresh_token": "",
  // The googledrive id of the root directory where the direct file link is based
  "root_id": "",
  // A strong password, keep it yourself
  "key": "123456",
  // The maximum validity period of pickcode.(ms)   5 days by default. Set to 0 means permanently valid.
  "pickcode_maxage": 5 * 24 * 60 * 60 * 1000
};
```

前三项参照 GoIndex 的说明配置，`root_id` 为直链基于的根目录的 drive id，`key` 为自己设置一个密码，`pickcode_maxage` 为直链最长有效期，以毫秒为单位，设置为0时，不验证直链有效期，直链永久有效。

然后保存并部署 worker

### 直链分发端配置

以 Node.js 为例：

```bash
npm install crypto-js --save
```

在提供直链时要计算一个加密后的 `pickcode` 参数，pickcode 明文内容应为一个 jsonobject ，格式如下：

```json
{"path":"movie/demo.mp4","time":1586270000000}
```

`path` 为请求的文件路径，`time` 为 当前时间毫秒值

 计算 pickcode 密文示例代码，参考 node_generate_pickcode.js

```javascript
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
```

输出：

```text
path: movie/demo.mp4
url: https://name.my.workers.dev/movie/demo.mp4?pickcode=VTJGc2RHVmtYMTl5Q...
```

在请求文件路径时，计算出 pickcode ，然后附加一个 pickcode query parameter 到直链的 GET 请求 url，cloudflare worker 端接收到 pickcode 后，验证 path 和 time 均有效的情况下，返回文件，其他任何情况均会返回一个 404 状态码。



## 开发

1. clone 这个项目

2. `npm install`

3. 修改 `src/main.js` 中的 worker 源代码

4. 构建： `npm run build`

   快速预览 worker ：`npm run quick-preview`



## 其他

### 加密说明

使用 crypto-js ，默认根据提供的密码使用 PBKDF2 加盐派生密钥，然后使用 aes-256-cbc 算法加密。

如果你要使用其他语言作为 pickcode 分发端和 worker 对接，你可能需要自定制 CBC 模式的 key 和 iv ，可以参考：https://cryptojs.gitbook.io/docs/#progressive-ciphering ，或者你可能考虑使用 https://github.com/ricmoo/aes-js ，同样支持 cloudflare worker 中的 javascript 环境，似乎更容易和其他语言的 AES 加密进行对接。