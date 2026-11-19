import {json,requireGoogleAdmin,signGoogleState} from "../../../lib/google-drive.js";
export async function onRequestPost({request,env}){
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REDIRECT_URI||!env.GOOGLE_OAUTH_STATE_SECRET)return json({error:"Google OAuth credentials and redirect URI are not configured in Cloudflare Pages."},503);
  const auth=await requireGoogleAdmin(request,env);if(auth.response)return auth.response;
  try{
    const state=await signGoogleState({uid:auth.user.id,exp:Date.now()+10*60*1000,nonce:crypto.randomUUID()},env.GOOGLE_OAUTH_STATE_SECRET);
    const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id",env.GOOGLE_CLIENT_ID);url.searchParams.set("redirect_uri",env.GOOGLE_REDIRECT_URI);
    url.searchParams.set("response_type","code");url.searchParams.set("scope","https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email");
    url.searchParams.set("access_type","offline");url.searchParams.set("prompt","consent");url.searchParams.set("include_granted_scopes","true");url.searchParams.set("state",state);
    return json({authorization_url:url.toString()});
  }catch(error){return json({error:error.message||"Could not start Google Drive authorization"},500);}
}
