function MyEncrypt() {
    this._keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
}

MyEncrypt.prototype.encode = function(data) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;
    data = this._utf8_encode(data);
    while (i < data.length) {
        chr1 = data.charCodeAt(i++);
        chr2 = data.charCodeAt(i++);
        chr3 = data.charCodeAt(i++);
        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;
        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }
        output = output +
            this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
            this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
    }
    return output;
}

MyEncrypt.prototype.decode = function (data) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
    data = data.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    while (i < data.length) {
        enc1 = this._keyStr.indexOf(data.charAt(i++));
        enc2 = this._keyStr.indexOf(data.charAt(i++));
        enc3 = this._keyStr.indexOf(data.charAt(i++));
        enc4 = this._keyStr.indexOf(data.charAt(i++));
        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;
        output = output + String.fromCharCode(chr1);
        if (enc3 != 64) {
            output = output + String.fromCharCode(chr2);
        }
        if (enc4 != 64) {
            output = output + String.fromCharCode(chr3);
        }
    }
    output = _utf8_decode(output);
    return output;
}

MyEncrypt.prototype._utf8_encode = function(data) {
    data = data.replace(/\r\n/g, "\n");
    var data = "";
    for (var n = 0; n < data.length; n++) {
        var c = data.charCodeAt(n);
        if (c < 128) {
            data += String.fromCharCode(c);
        } else if ((c > 127) && (c < 2048)) {
            data += String.fromCharCode((c >> 6) | 192);
            data += String.fromCharCode((c & 63) | 128);
        } else {
            data += String.fromCharCode((c >> 12) | 224);
            data += String.fromCharCode(((c >> 6) & 63) | 128);
            data += String.fromCharCode((c & 63) | 128);
        }

    }
    return data;
}

MyEncrypt.prototype._utf8_decode = function(data) {
    var string = "";
    var i = 0;
    var c = c1 = c2 = 0;
    while (i < data.length) {
        c = data.charCodeAt(i);
        if (c < 128) {
            string += String.fromCharCode(c);
            i++;
        } else if ((c > 191) && (c < 224)) {
            c2 = data.charCodeAt(i + 1);
            string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
            i += 2;
        } else {
            c2 = data.charCodeAt(i + 1);
            c3 = data.charCodeAt(i + 2);
            string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            i += 3;
        }
    }
    return string;
}

export {MyEncrypt};