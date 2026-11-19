import {json,requireGoogleAdmin,getFreshGoogleDriveConnection} from "../../../lib/google-drive.js";
export async function onRequestGet({request,env}){
  const auth=await requireGoogleAdmin(request,env);if(auth.response)return auth.response;
  try{
    const connection=await getFreshGoogleDriveConnection(env);
    if(!connection)return json({connected:false});
    const response=await fetch("https://www.googleapis.com/drive/v3/about?fields=user,storageQuota",{headers:{authorization:"Bearer "+connection.access_token}});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error?.message||"Google Drive quota lookup failed.");
    return json({connected:true,email:payload.user?.emailAddress||connection.account_id,display_name:payload.user?.displayName||"",total_bytes:Number(payload.storageQuota?.limit||0),used_bytes:Number(payload.storageQuota?.usage||0)});
  }catch(error){return json({connected:false,error:error.message||"Google Drive status unavailable"},502);}
}
