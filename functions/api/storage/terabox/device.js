import {json,requirePrimaryAdmin} from "../../../lib/terabox.js";
export async function onRequestPost({request,env}){
  if(!env.TERABOX_CLIENT_ID||!env.TERABOX_CLIENT_SECRET||!env.TERABOX_PRIVATE_SECRET||!env.PROVIDER_TOKEN_ENCRYPTION_KEY)return json({error:"TeraBox app credentials and token encryption secret must be configured in Cloudflare Pages."},503);
  const auth=await requirePrimaryAdmin(request,env);if(auth.response)return auth.response;
  try{
    const response=await fetch("https://www.terabox.com/oauth/devicecode?client_id="+encodeURIComponent(env.TERABOX_CLIENT_ID));
    const payload=await response.json();
    if(!response.ok||Number(payload.errno||0)!==0)throw new Error(payload.show_msg||"Could not start TeraBox device authorization.");
    const data=payload.data||{};
    if(!data.device_code||!data.qrcode_url)throw new Error("TeraBox did not return a usable device QR code.");
    const qr=String(data.qrcode_url);
    return json({device_code:data.device_code,qrcode_url:qr.startsWith("http")||qr.startsWith("data:")?qr:"data:image/png;base64,"+qr,interval:Number(data.interval)||5,expires_in:Number(data.expires_in)||300});
  }catch(error){return json({error:error.message||"TeraBox authorization failed"},502);}
}
