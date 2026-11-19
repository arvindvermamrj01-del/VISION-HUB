import {json,supabase,verifyGoogleState,saveGoogleDriveTokens} from "../../../lib/google-drive.js";
export async function onRequestGet({request,env}){
  const url=new URL(request.url),code=url.searchParams.get("code"),state=url.searchParams.get("state"),oauthError=url.searchParams.get("error");
  const redirect=(key,value)=>{const target=new URL("/",request.url);target.searchParams.set(key,value);target.hash="control-center";return Response.redirect(target.toString(),302);};
  if(oauthError)return redirect("google_drive_error","Google authorization was cancelled.");
  if(!code||!state||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REDIRECT_URI||!env.GOOGLE_OAUTH_STATE_SECRET||!env.PROVIDER_TOKEN_ENCRYPTION_KEY)return redirect("google_drive_error","Google Drive OAuth configuration is incomplete.");
  try{
    const payload=await verifyGoogleState(state,env.GOOGLE_OAUTH_STATE_SECRET);
    const profile=await supabase(env,"profiles?id=eq."+encodeURIComponent(payload.uid)+"&select=role");
    if(!profile.ok)return redirect("google_drive_error","Could not verify the initiating Admin account.");
    const rows=await profile.json();if(rows?.[0]?.role!=="admin")return redirect("google_drive_error","Only the primary Admin can connect Google Drive.");
    const form=new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:env.GOOGLE_REDIRECT_URI,grant_type:"authorization_code"});
    const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form});
    const tokens=await tokenResponse.json().catch(()=>({}));
    if(!tokenResponse.ok||!tokens.access_token)return redirect("google_drive_error",tokens.error_description||"Google token exchange failed.");
    const userResponse=await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{headers:{authorization:"Bearer "+tokens.access_token}});
    const account=userResponse.ok?await userResponse.json():{};
    await saveGoogleDriveTokens(env,{id:payload.uid},tokens,account.email||account.id||"Google Drive");
    return redirect("google_drive_connected","1");
  }catch(error){return redirect("google_drive_error",error.message||"Google Drive connection failed.");}
}
