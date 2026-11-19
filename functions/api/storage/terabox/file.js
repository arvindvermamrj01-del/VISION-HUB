import {json,requireContentStaff,getFreshTeraBoxConnection,postForm,teraboxFolder} from "../../../../lib/terabox.js";
export async function onRequestDelete({request,env}){
  const auth=await requireContentStaff(request,env);if(auth.response)return auth.response;
  const path=new URL(request.url).searchParams.get("path")||"";
  if(!path.startsWith(teraboxFolder(env))||path.includes(".."))return json({error:"Invalid TeraBox file path"},400);
  try{
    const connection=await getFreshTeraBoxConnection(env);if(!connection)return json({error:"TeraBox account is not connected"},409);
    const result=await postForm(connection.api_domain+"/openapi/api/filemanager?access_tokens="+encodeURIComponent(connection.access_token)+"&opera=delete&async=0",{
      filelist:JSON.stringify([path])
    });
    return json({ok:true,deleted_path:path,result});
  }catch(error){return json({error:error.message||"TeraBox file could not be deleted"},502);}
}
