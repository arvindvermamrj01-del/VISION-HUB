import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as startTeraBoxDevice } from "../functions/api/storage/terabox/device.js";
import { onRequestPost as pollTeraBoxDevice } from "../functions/api/storage/terabox/poll.js";
import { onRequestGet as getTeraBoxStatus } from "../functions/api/storage/terabox/status.js";
import { onRequestPost as initTeraBoxUpload } from "../functions/api/storage/terabox/upload/init.js";
import { onRequestPost as uploadTeraBoxPart } from "../functions/api/storage/terabox/upload/part.js";
import { onRequestPost as completeTeraBoxUpload } from "../functions/api/storage/terabox/upload/complete.js";
import { onRequestDelete as deleteTeraBoxContent } from "../functions/api/storage/terabox/file.js";
import { onRequestGet as streamTeraBoxContent } from "../functions/api/storage/terabox/stream.js";

test("TeraBox Cloudflare Pages routes load with the expected handlers", () => {
  for (const handler of [
    startTeraBoxDevice, pollTeraBoxDevice, getTeraBoxStatus,
    initTeraBoxUpload, uploadTeraBoxPart, completeTeraBoxUpload,
    deleteTeraBoxContent, streamTeraBoxContent
  ]) assert.equal(typeof handler, "function");
});
