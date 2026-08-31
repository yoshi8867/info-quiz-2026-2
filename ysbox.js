/* ysbox — 순수 JS SHA-256 기반 잠금 상자.
 *
 * WebCrypto(crypto.subtle) 를 쓰지 않는다. 그것은 https 나 localhost 에서만
 * 동작해서, 학교 랜의 평문 http 나 file:// 로 열면 통째로 죽는다.
 * 여기 있는 것은 어디서든 도는 순수 구현이다.
 *
 * Python 쪽 ysbox.py 와 바이트 단위로 같은 결과를 낸다 (test_ysbox 로 검증).
 */
(function (root) {
  "use strict";

  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(bytes) {
    var l = bytes.length;
    var padded = (((l + 9) + 63) >> 6) << 6;
    var m = new Uint8Array(padded);
    m.set(bytes);
    m[l] = 0x80;
    var bits = l * 8;
    var hi = Math.floor(bits / 4294967296);
    var lo = bits >>> 0;
    m[padded - 8] = (hi >>> 24) & 255;
    m[padded - 7] = (hi >>> 16) & 255;
    m[padded - 6] = (hi >>> 8) & 255;
    m[padded - 5] = hi & 255;
    m[padded - 4] = (lo >>> 24) & 255;
    m[padded - 3] = (lo >>> 16) & 255;
    m[padded - 2] = (lo >>> 8) & 255;
    m[padded - 1] = lo & 255;

    var H = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    var w = new Uint32Array(64);

    for (var off = 0; off < padded; off += 64) {
      for (var i = 0; i < 16; i++) {
        w[i] = (m[off + 4 * i] << 24) | (m[off + 4 * i + 1] << 16)
             | (m[off + 4 * i + 2] << 8) | m[off + 4 * i + 3];
      }
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        var s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
        var s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3];
      var e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }

    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) {
      out[4 * i] = (H[i] >>> 24) & 255;
      out[4 * i + 1] = (H[i] >>> 16) & 255;
      out[4 * i + 2] = (H[i] >>> 8) & 255;
      out[4 * i + 3] = H[i] & 255;
    }
    return out;
  }

  var HEXD = "0123456789abcdef";

  function hex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
      s += HEXD[bytes[i] >>> 4] + HEXD[bytes[i] & 15];
    }
    return s;
  }

  function utf8(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    var esc = unescape(encodeURIComponent(str));
    var a = new Uint8Array(esc.length);
    for (var i = 0; i < esc.length; i++) a[i] = esc.charCodeAt(i);
    return a;
  }

  function fromUtf8(bytes) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  var ROUNDS = 1000;

  /* 비밀값을 키로 늘린다. 느리게 만들어 두어야 무차별 대입이 성립하지 않는다. */
  function kdf(secret, salt) {
    var k = hex(sha256(utf8(salt + "|" + secret)));
    for (var i = 0; i < ROUNDS; i++) {
      k = hex(sha256(utf8(salt + "|" + k)));
    }
    return k;
  }

  function keystream(keyHex, n) {
    var out = new Uint8Array(n);
    var i = 0, off = 0;
    while (off < n) {
      var blk = sha256(utf8(keyHex + ":" + i));
      for (var j = 0; j < 32 && off < n; j++, off++) out[off] = blk[j];
      i++;
    }
    return out;
  }

  /* 키가 맞는지 먼저 확인하는 짧은 표식. 틀린 키로 쓰레기를 그리지 않으려고. */
  function tag(keyHex) {
    return hex(sha256(utf8(keyHex + ":chk"))).slice(0, 16);
  }

  function b64decode(s) {
    var raw = atob(s);
    var a = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return a;
  }

  /* box = {tag, data}. 키가 틀리면 null 을 준다. */
  function open(box, secret, salt) {
    var key = kdf(secret, salt);
    if (tag(key) !== box.tag) return null;
    var ct = b64decode(box.data);
    var ks = keystream(key, ct.length);
    var pt = new Uint8Array(ct.length);
    for (var i = 0; i < ct.length; i++) pt[i] = ct[i] ^ ks[i];
    return fromUtf8(pt);
  }

  /* 코드 입력 정규화 — 대소문자·공백·하이픈을 무시한다 */
  function normCode(s) {
    return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  /* 정답 입력 정규화 — 소문자, 영문/숫자/한글만 남긴다 */
  function normAnswer(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
  }

  root.ysbox = {
    sha256: sha256, hex: hex, utf8: utf8, kdf: kdf, tag: tag,
    open: open, normCode: normCode, normAnswer: normAnswer
  };
})(typeof module !== "undefined" && module.exports ? module.exports : window);
