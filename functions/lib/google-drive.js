import {json,supabase,encryptSecret,decryptSecret} from "./terabox.js";
function base64url(bytes){
  let binary="";for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function decode64url(value){
  let encoded=String(value).replace(/-/g,"+").replace(/_/g,"/");
  while(encoded.length%4)encoded+="=";
  const binary=atob(encoded);return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function hmacKey(secret){
  if(!secret||String(secret).length<32)throw new Error("GOOGLE_OAUTH_STATE_SECRET must contain at least 32 characters.");
  return crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
export async function signGoogleState(payload,secret){
  const body=base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key=await hmacKey(secret);
  const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body));
  return body+"."+base64url(new Uint8Array(signature));
}
export async function verifyGoogleState(state,secret){
  const [body,signature,...rest]=String(state||"").split(".");
  if(!body||!signature||rest.length)throw new Error("Invalid Google OAuth state.");
  const key=await hmacKey(secret);
  const valid=await crypto.subtle.verify("HMAC",key,decode64url(signature),new TextEncoder().encode(body));
  if(!valid)throw new Error("Google OAuth state signature is invalid.");
  const payload=JSON.parse(new TextDecoder().decode(decode64url(body)));
  if(!payload.uid||!Number.isFinite(payload.exp)||payload.exp<Date.now())throw new Error("Google OAuth state expired.");
  return payload;
}
export async function requireGoogleAdmin(request,env){
  if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)return {response:json({error:"Supabase server configuration is missing"},503)};
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return {response:json({error:"Authentication required"},401)};
  const auth=await fetch(env.SUPABASE_URL+"/auth/v1/user",{headers:{apikey:env.SUPABASE_ANON_KEY,authorization:"Bearer "+token}});
  if(!auth.ok)return {response:json({error:"Invalid session"},401)};
  const user=await auth.json();
  const role=await supabase(env,"profiles?id=eq."+encodeURIComponent(user.id)+"&select=role");
  if(!role.ok)return {response:json({error:"Could not verify primary Admin"},503)};
  const rows=await role.json();
  if(rows?.[0]?.role!=="admin")return {response:json({error:"Only the primary Admin can connect Google Drive"},403)};
  return {user};
}
export async function requireGoogleContentStaff(request,env){
  if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)return {response:json({error:"Supabase server configuration is missing"},503)};
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return {response:json({error:"Authentication required"},401)};
  const auth=await fetch(env.SUPABASE_URL+"/auth/v1/user",{headers:{apikey:env.SUPABASE_ANON_KEY,authorization:"Bearer "+token}});
  if(!auth.ok)return {response:json({error:"Invalid session"},401)};
  const user=await auth.json();
  const role=await supabase(env,"profiles?id=eq."+encodeURIComponent(user.id)+"&select=role");
  if(!role.ok)return {response:json({error:"Could not verify staff role"},503)};
  const rows=await role.json();
  if(!["admin","sub_admin","content_editor"].includes(rows?.[0]?.role))return {response:json({error:"Content upload permission required"},403)};
  return {user,role:rows[0].role};
}
export async function saveGoogleDriveTokens(env,user,tokens,email,oldRefreshToken=null){
  const refreshToken=tokens.refresh_token||oldRefreshToken;
  if(!refreshToken)throw new Error("Google did not issue a refresh token. Reconnect with consent enabled.");
  const record={
    provider:"google_drive",account_id:email||"",
    access_token_ciphertext:await encryptSecret(tokens.access_token,env),
    refresh_token_ciphertext:await encryptSecret(refreshToken,env),
    api_domain:"www.googleapis.com",upload_domain:"www.googleapis.com",
    access_expires_at:new Date(Date.now()+Number(tokens.expires_in||3600)*1000).toISOString(),
    refresh_expires_at:null,connected_by:user.id,updated_at:new Date().toISOString()
  };
  const response=await supabase(env,"vh_provider_connections?on_conflict=provider",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify(record)});
  if(!response.ok)throw new Error("Could not securely save Google Drive connection.");
}
export async function loadGoogleDriveConnection(env){
  const response=await supabase(env,"vh_provider_connections?provider=eq.google_drive&select=*");
  if(!response.ok)throw new Error("Google Drive connection record unavailable. Run provider-connections.sql.");
  const rows=await response.json();if(!rows?.length)return null;
  const row=rows[0];
  return {...row,access_token:await decryptSecret(row.access_token_ciphertext,env),refresh_token:await decryptSecret(row.refresh_token_ciphertext,env)};
}
export async function getFreshGoogleDriveConnection(env){
  const row=await loadGoogleDriveConnection(env);if(!row)return null;
  if(Date.parse(row.access_expires_at||"0")>Date.now()+60000)return row;
  const form=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:row.refresh_token,grant_type:"refresh_token"});
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form});
  const tokens=await response.json().catch(()=>({}));
  if(!response.ok||!tokens.access_token)throw new Error("Google Drive token refresh failed. Reconnect the account.");
  const emailResponse=await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{headers:{authorization:"Bearer "+tokens.access_token}});
  const account=emailResponse.ok?await emailResponse.json():{email:row.account_id};
  await saveGoogleDriveTokens(env,{id:row.connected_by},tokens,account.email||row.account_id,row.refresh_token);
  return await loadGoogleDriveConnection(env);
}
export function googleJsonError(payload){return payload?.error?.message||payload?.error_description||"Google Drive API request failed.";}
export {json,supabase};
