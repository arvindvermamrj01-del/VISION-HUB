import test from "node:test";
import assert from "node:assert/strict";
import { signGoogleState, verifyGoogleState } from "../functions/lib/google-drive.js";
import { onRequestPost as connectGoogleDrive } from "../functions/api/storage/google-drive/connect.js";
import { onRequestGet as googleDriveCallback } from "../functions/api/storage/google-drive/callback.js";
import { onRequestGet as googleDriveStatus } from "../functions/api/storage/google-drive/status.js";
import { onRequestPost as initGoogleDriveUpload } from "../functions/api/storage/google-drive/upload/init.js";
import { onRequestPost as uploadGoogleDrivePart } from "../functions/api/storage/google-drive/upload/part.js";
import { onRequestDelete as deleteGoogleDriveContent } from "../functions/api/storage/google-drive/file.js";

test("Google OAuth state is signed, time-limited and tamper resistant", async () => {
  const secret = "test-state-secret-that-is-at-least-32-characters";
  const state = await signGoogleState({uid:"user-123",exp:Date.now()+60000,nonce:"nonce"},secret);
  const payload = await verifyGoogleState(state,secret);
  assert.equal(payload.uid,"user-123");
  await assert.rejects(() => verifyGoogleState(state+"x",secret));
  const expired = await signGoogleState({uid:"user-123",exp:Date.now()-1000,nonce:"nonce"},secret);
  await assert.rejects(() => verifyGoogleState(expired,secret));
});

test("Google Drive Cloudflare Pages routes load with expected handlers", () => {
  for (const handler of [
    connectGoogleDrive,googleDriveCallback,googleDriveStatus,
    initGoogleDriveUpload,uploadGoogleDrivePart,deleteGoogleDriveContent
  ]) assert.equal(typeof handler,"function");
});
