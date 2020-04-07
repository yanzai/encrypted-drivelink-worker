const {AES, enc} = require("crypto-js");

let gd = null;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (!gd) gd = new GoogleDrive(config);
  let url = new URL(request.url);
  let path = url.pathname;

  function notFound() {
    return new Response('Not Found !', {status: 404});
  }

  if (path.endsWith('/')) return notFound();
  const pickcode = url.searchParams.get('pickcode');
  if (!pickcode) return notFound();

  let age_valid = false;
  let path_valid = false;
  try {
    const bytes = AES.decrypt(atob(pickcode), config.key);
    let {time, path: received_path} = JSON.parse(bytes.toString(enc.Utf8));
    // verify max age
    if (!config.pickcode_maxage) age_valid = true;
    else if (time && (time + config.pickcode_maxage > Date.now())) {
      age_valid = true;
    }

    function trim(str) {
      return str.startsWith('/') ? str.slice(1) : str;
    }

    received_path = trim(received_path);
    // verify path
    if (received_path && received_path === trim(path)) {
      path_valid = true;
    }

    // console.log(path);
    if (path_valid && age_valid) {
      const file = await gd.file(path);
      const range = request.headers.get('Range');
      return gd.down(file.id, range);
    }

    return notFound();
  } catch (e) {
    // return new Response(e.toString(), {status: 500});
    return notFound();
  }
}

// 以下代码，直接从 goindex 那里简单 copy 过来
class GoogleDrive {
  constructor(config) {
    this.config = config;
    this.paths = [];
    this.files = [];
    this.paths["/"] = config['root_id'];
  }

  enQuery(data) {
    const ret = [];
    for (let d in data) {
      ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
    }
    return ret.join('&');
  }

  async accessToken() {
    if (this.config.expires === undefined || this.config.expires < Date.now()) {
      const obj = await this.fetchAccessToken();
      if (obj.access_token) {
        this.config.accessToken = obj.access_token;
        this.config.expires = Date.now() + 3500 * 1000;
      }
    }
    return this.config.accessToken;
  }

  async fetchAccessToken() {
    console.log("fetchAccessToken");
    const url = "https://www.googleapis.com/oauth2/v4/token";
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const post_data = {
      'client_id': this.config.client_id,
      'client_secret': this.config.client_secret,
      'refresh_token': this.config.refresh_token,
      'grant_type': 'refresh_token'
    };

    const requestOption = {
      'method': 'POST',
      'headers': headers,
      'body': this.enQuery(post_data)
    };

    const response = await fetch(url, requestOption);
    return await response.json();
  }

  async requestOption(headers = {}, method = 'GET') {
    const accessToken = await this.accessToken();
    headers['authorization'] = 'Bearer ' + accessToken;
    return {'method': method, 'headers': headers};
  }

  async down(id, range = '') {
    let url = `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
    let requestOption = await this.requestOption();
    requestOption.headers['Range'] = range;
    return await fetch(url, requestOption);
  }

  async file(path) {
    if (typeof this.files[path] == 'undefined') {
      this.files[path] = await this._file(path);
    }
    return this.files[path];
  }

  async _file(path) {
    let arr = path.split('/');
    let name = arr.pop();
    name = decodeURIComponent(name).replace(/\'/g, "\\'");
    let dir = arr.join('/') + '/';
    let parent = await this.findPathId(dir);
    let url = 'https://www.googleapis.com/drive/v3/files';
    let params = {'includeItemsFromAllDrives': true, 'supportsAllDrives': true};
    params.q = `'${parent}' in parents and name = '${name}' and trashed = false`;
    // params.fields = "files(id)";
    params.fields = "files(id, name, mimeType, size ,createdTime, modifiedTime, iconLink, thumbnailLink)";
    url += '?' + this.enQuery(params);
    let requestOption = await this.requestOption();
    let response = await fetch(url, requestOption);
    let obj = await response.json();
    return obj.files[0];
  }

  async findPathId(path) {
    let c_path = '/';
    let c_id = this.paths[c_path];
    let arr = path.trim('/').split('/');

    for (let name of arr) {
      c_path += name + '/';

      if (typeof this.paths[c_path] == 'undefined') {
        let id = await this._findDirId(c_id, name);
        this.paths[c_path] = id;
      }

      c_id = this.paths[c_path];

      if (c_id == undefined || c_id == null) {
        break;
      }
    }

    return this.paths[path];
  }

  async _findDirId(parent, name) {
    name = decodeURIComponent(name).replace(/\'/g, "\\'");
    if (parent == undefined) {
      return null;
    }

    let url = 'https://www.googleapis.com/drive/v3/files';
    let params = {'includeItemsFromAllDrives': true, 'supportsAllDrives': true};
    params.q = `'${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name}'  and trashed = false`;
    params.fields = "nextPageToken, files(id, name, mimeType)";
    url += '?' + this.enQuery(params);
    let requestOption = await this.requestOption();
    let response = await fetch(url, requestOption);
    let obj = await response.json();
    if (obj.files[0] == undefined) {
      return null;
    }
    return obj.files[0].id;
  }
}

String.prototype.trim = function (char) {
  if (char) {
    return this.replace(new RegExp('^\\' + char + '+|\\' + char + '+$', 'g'), '');
  }
  return this.replace(/^\s+|\s+$/g, '');
};


