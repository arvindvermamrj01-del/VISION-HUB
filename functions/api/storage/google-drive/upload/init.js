import {json,requireGoogleContentStaff,getFreshGoogleDriveConnection} from "../../../../lib/google-drive.js";
export async function onRequestPost({request,env}){
  const auth=await requireGoogleContentStaff(request,env);if(auth.response)return auth.response;
  let body;try{body=await request.json();}catch(_){return json({error:"Invalid JSON"},400);}
  const name=String(body.file_name||"").split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g,"").replace(/[^a-zA-Z0-9._() -]/g,"_").slice(0,180);
  const mime=String(body.mime_type||"video/mp4"),size=Number(body.size||0);
  if(!name||!mime.startsWith("video/")||!Number.isSafeInteger(size)||size<=0)return json({error:"A valid video filename, MIME type and file size are required"},400);
  try{
    const connection=await getFreshGoogleDriveConnection(env);if(!connection)return json({error:"Connect the primary Admin Google Drive account first."},409);
    const metadata={name,mimeType:mime};
    if(env.GOOGLE_DRIVE_FOLDER_ID)metadata.parents=[env.GOOGLE_DRIVE_FOLDER_ID];
    const response=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,webViewLink,webContentLink,size",{
      method:"POST",headers:{authorization:"Bearer "+connection.access_token,"content-type":"application/json","x-upload-content-type":mime,"x-upload-content-length":String(size)},
      body:JSON.stringify(metadata)
    });
    if(!response.ok)throw new Error((await response.text()).slice(0,500)||"Google Drive upload session could not be created.");
    const sessionUrl=response.headers.get("Location");
    if(!sessionUrl)throw new Error("Google Drive did not return a resumable upload URL.");
    const parsed=new URL(sessionUrl);
    if(parsed.protocol!=="https:"||!parsed.hostname.endsWith(".googleapis.com")||parsed.pathname!=="/upload/drive/v3/files")throw new Error("Google Drive returned an unexpected upload URL.");
    return json({session_url:sessionUrl,chunk_size:8*1024*1024});
  }catch(error){return json({error:error.message||"Google Drive upload could not be initialized"},502);}
}
