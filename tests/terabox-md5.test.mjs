import test from "node:test";
import assert from "node:assert/strict";
import { md5, teraboxSign, encryptSecret, decryptSecret } from "../functions/lib/terabox.js";

test("TeraBox MD5 signature helper matches standard MD5 vectors", () => {
  assert.equal(md5(""), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(md5("a"), "0cc175b9c0f1b6a831c399e269772661");
  assert.equal(md5("abc"), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(md5("message digest"), "f96b697d7cb7938d525a2f31aaf161d0");
  assert.equal(md5("abcdefghijklmnopqrstuvwxyz"), "c3fcd3d76192e4007dfb496cca67e13b");
});

test("TeraBox signing string uses the documented parameter order", () => {
  const env = {
    TERABOX_CLIENT_ID: "client-id",
    TERABOX_CLIENT_SECRET: "client-secret",
    TERABOX_PRIVATE_SECRET: "private-secret"
  };
  assert.equal(
    teraboxSign(env, 1700000000),
    md5("client-id_1700000000_client-secret_private-secret")
  );
});

test("provider tokens are encrypted and can be decrypted with the configured key", async () => {
  const env = { PROVIDER_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") };
  const first = await encryptSecret("refresh-token-value", env);
  const second = await encryptSecret("refresh-token-value", env);
  assert.notEqual(first, "refresh-token-value");
  assert.notEqual(first, second, "AES-GCM must use a fresh IV for each encryption");
  assert.equal(await decryptSecret(first, env), "refresh-token-value");
});

globalThis.window = {};
await import("../js/terabox-md5.js");
test("browser chunk checksum matches the server-side MD5 implementation", async () => {
  assert.equal(await window.VH_MD5_BLOB(new Blob(["abc"])), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(await window.VH_MD5_BLOB(new Blob(["message digest"])), "f96b697d7cb7938d525a2f31aaf161d0");
});
