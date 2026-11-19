import {json,requirePrimaryAdmin,postForm,tokenInfo,saveTeraBoxTokens,teraboxSign} from "../../../lib/terabox.js";
export async function onRequestPost({request,env}){
  if(!env.TERABOX_CLIENT_ID||!env.TERABOX_CLIENT_SECRET||!env.TERABOX_PRIVATE_SECRET||!env.PROVIDER_TOKEN_ENCRYPTION_KEY)return json({error:"TeraBox app credentials are not configured"},503);
  const auth=await requirePrimaryAdmin(request,env);if(auth.response)return auth.response;
  let body;try{body=await request.json();}catch(_){return json({error:"Invalid JSON"},400);}
  const deviceCode=String(body.device_code||"");
  if(deviceCode.length<6||deviceCode.length>2048)return json({error:"Invalid TeraBox device code"},400);
  try{
    const timestamp=Math.floor(Date.now()/1000);
    const tokens=await postForm("https://www.terabox.com/oauth/gettoken",{
      client_id:env.TERABOX_CLIENT_ID,client_secret:env.TERABOX_CLIENT_SECRET,
      grant_type:"device_code",code:deviceCode,timestamp,sign:teraboxSign(env,timestamp)
    });
    if(!tokens.access_token||!tokens.refresh_token)throw new Error("TeraBox returned incomplete authorization tokens.");
    const info=await tokenInfo(tokens.access_token);
    await saveTeraBoxTokens(env,auth.user,tokens,info);
    return json({connected:true,account_id:info.user_id});
  }catch(error){
    if(error.code===400001||String(error.message||"").includes("400001"))return json({pending:true},202);
    return json({error:error.message||"TeraBox authorization failed"},502);
  }
}
