const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function requirePrimaryAdmin(request,env){
  if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)return {response:json({error:"Supabase server configuration is missing"},503)};
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return {response:json({error:"Authentication required"},401)};
  const auth=await fetch(env.SUPABASE_URL+"/auth/v1/user",{headers:{apikey:env.SUPABASE_ANON_KEY,authorization:"Bearer "+token}});
  if(!auth.ok)return {response:json({error:"Invalid session"},401)};
  const user=await auth.json();
  const role=await supabase(env,"/rest/v1/profiles?id=eq."+encodeURIComponent(user.id)+"&select=role");
  if(!role.ok)return {response:json({error:"Could not verify administrator"},503)};
  const rows=await role.json();
  if(rows?.[0]?.role!=="admin")return {response:json({error:"Only the primary Admin can connect storage providers"},403)};
  return {user};
}
export async function supabase(env,path,options={}){
  return fetch(env.SUPABASE_URL+"/rest/v1/"+path,{...options,headers:{
    apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY,
    "content-type":"application/json",...(options.headers||{})
  }});
}
function md5(text){
  const bytes=new TextEncoder().encode(String(text));
  const bitLength=bytes.length*8;
  const length=Math.ceil((bytes.length+9)/64)*64;
  const padded=new Uint8Array(length);padded.set(bytes);padded[bytes.length]=128;
  const view=new DataView(padded.buffer);
  view.setUint32(length-8,bitLength>>>0,true);
  view.setUint32(length-4,Math.floor(bitLength/4294967296),true);
  const shifts=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const k=Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0);
  let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
  for(let offset=0;offset<length;offset+=64){
    const words=Array.from({length:16},(_,i)=>view.getUint32(offset+i*4,true));
    let a=a0,b=b0,c=c0,d=d0;
    for(let i=0;i<64;i++){
      let f,g;
      if(i<16){f=(b&c)|(~b&d);g=i;}
      else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;}
      else if(i<48){f=b^c^d;g=(3*i+5)%16;}
      else{f=c^(b|~d);g=(7*i)%16;}
      const sum=(a+f+k[i]+words[g])>>>0;
      const shift=shifts[i];
      const rotated=((sum<<shift)|(sum>>>(32-shift)))>>>0;
      const next=(b+rotated)>>>0;
      a=d;d=c;c=b;b=next;
    }
    a0=(a0+a)>>>0;b0=(b0+b)>>>0;c0=(c0+c)>>>0;d0=(d0+d)>>>0;
  }
  return [a0,b0,c0,d0].map(word=>[word&255,(word>>>8)&255,(word>>>16)&255,(word>>>24)&255].map(v=>v.toString(16).padStart(2,"0")).join("")).join("");
}
function bytesToBase64(bytes){let binary="";for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);}
function base64ToBytes(value){const binary=atob(value);return Uint8Array.from(binary,c=>c.charCodeAt(0));}
async function encryptionKey(env){
  const value=String(env.PROVIDER_TOKEN_ENCRYPTION_KEY||"");
  if(!value)throw new Error("PROVIDER_TOKEN_ENCRYPTION_KEY is not configured");
  let bytes;
  if(/^[0-9a-f]{64}$/i.test(value))bytes=Uint8Array.from(value.match(/.{2}/g),x=>parseInt(x,16));
  else bytes=base64ToBytes(value.replace(/-/g,"+").replace(/_/g,"/"));
  if(bytes.length!==32)throw new Error("PROVIDER_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return crypto.subtle.importKey("raw",bytes,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
export async function encryptSecret(value,env){
  const key=await encryptionKey(env),iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array([...iv,...new Uint8Array(cipher)]));
}
export async function decryptSecret(value,env){
  const key=await encryptionKey(env),bytes=base64ToBytes(value),iv=bytes.slice(0,12),cipher=bytes.slice(12);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,cipher);
  return new TextDecoder().decode(plain);
}
function form(values){const body=new FormData();for(const [key,value] of Object.entries(values))body.set(key,String(value));return body;}
function teraboxError(payload){return payload?.show_msg||payload?.message||("TeraBox API error "+String(payload?.errno??"unknown"));}
async function postForm(url,values){
  const response=await fetch(url,{method:"POST",body:form(values)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||Number(payload.errno||0)!==0){
    const error=new Error(teraboxError(payload));error.code=Number(payload.errno||0);throw error;
  }
  return payload.data||payload;
}
function safeDomain(value){
  const host=String(value||"").replace(/^https?:\/\//i,"").replace(/\/$/,"");
  if(!/^[a-z0-9.-]+$/i.test(host)||!host.endsWith(".terabox.com"))throw new Error("TeraBox returned an unexpected API domain");
  return "https://"+host;
}
async function tokenInfo(accessToken){
  const payload=await postForm("https://www.terabox.com/oauth/tokeninfo",{access_token:accessToken});
  return {api_domain:safeDomain(payload.api_domain),upload_domain:safeDomain(payload.upload_domain),user_id:String(payload.user_id||"")};
}
async function saveConnection(env,record){
  const response=await supabase(env,"vh_provider_connections?on_conflict=provider",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify(record)});
  if(!response.ok)throw new Error("Could not securely save TeraBox connection");
}
export async function loadTeraBoxConnection(env){
  const response=await supabase(env,"vh_provider_connections?provider=eq.terabox&select=*");
  if(!response.ok)throw new Error("TeraBox connection record unavailable. Run provider-connections.sql.");
  const rows=await response.json();if(!rows?.length)return null;
  const row=rows[0];
  const access_token=await decryptSecret(row.access_token_ciphertext,env);
  const refresh_token=await decryptSecret(row.refresh_token_ciphertext,env);
  return {...row,access_token,refresh_token};
}
export async function saveTeraBoxTokens(env,user,tokens,info,refreshExpiresAt=null){
  const now=Date.now(),accessExpires=new Date(now+Number(tokens.expires_in||172800)*1000).toISOString();
  const record={
    provider:"terabox",account_id:info.user_id,
    access_token_ciphertext:await encryptSecret(tokens.access_token,env),
    refresh_token_ciphertext:await encryptSecret(tokens.refresh_token,env),
    api_domain:info.api_domain,upload_domain:info.upload_domain,
    access_expires_at:accessExpires,
    refresh_expires_at:refreshExpiresAt||new Date(now+30*86400000).toISOString(),
    connected_by:user.id,updated_at:new Date().toISOString()
  };
  await saveConnection(env,record);
}
export async function getFreshTeraBoxConnection(env){
  const row=await loadTeraBoxConnection(env);if(!row)return null;
  if(Date.parse(row.access_expires_at||"0")>Date.now()+60000)return row;
  if(Date.parse(row.refresh_expires_at||"0")<=Date.now())throw new Error("TeraBox authorization expired. Reconnect the account.");
  const timestamp=Math.floor(Date.now()/1000);
  const sign=md5(env.TERABOX_CLIENT_ID+"_"+timestamp+"_"+env.TERABOX_CLIENT_SECRET+"_"+env.TERABOX_PRIVATE_SECRET);
  const tokens=await postForm("https://www.terabox.com/oauth/refreshtoken",{
    client_id:env.TERABOX_CLIENT_ID,client_secret:env.TERABOX_CLIENT_SECRET,
    refresh_token:row.refresh_token,timestamp,sign
  });
  const info=await tokenInfo(tokens.access_token);
  await saveTeraBoxTokens(env,{id:row.connected_by},tokens,info,row.refresh_expires_at);
  return await loadTeraBoxConnection(env);
}
export function teraboxSign(env,timestamp){
  return md5(env.TERABOX_CLIENT_ID+"_"+timestamp+"_"+env.TERABOX_CLIENT_SECRET+"_"+env.TERABOX_PRIVATE_SECRET);
}
export {json,postForm,tokenInfo};
