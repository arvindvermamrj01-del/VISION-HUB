import {json,requireContentStaff,getFreshTeraBoxConnection,postForm,teraboxFolder} from "../../../../lib/terabox.js";
export async function onRequestPost({request,env}){
  const auth=await requireContentStaff(request,env);if(auth.response)return auth.response;
  let body;try{body=await request.json();}catch(_){return json({error:"Invalid JSON"},400);}
  const path=String(body.path||""),uploadid=String(body.uploadid||""),size=Number(body.size||0),hashes=body.block_md5s;
  if(!path.startsWith(teraboxFolder(env))||path.includes(".."))return json({error:"Invalid TeraBox upload path"},400);
  if(!uploadid||uploadid.length>2048||!Number.isSafeInteger(size)||size<=0||!Array.isArray(hashes)||hashes.length<1||hashes.length>10000||hashes.some(x=>!/^[a-f0-9]{32}$/i.test(String(x))))return json({error:"Invalid TeraBox completion data"},400);
  try{
    const connection=await getFreshTeraBoxConnection(env);if(!connection)return json({error:"TeraBox account is not connected"},409);
    const result=await postForm(connection.api_domain+"/openapi/api/create?access_tokens="+encodeURIComponent(connection.access_token),{
      path,size,uploadid,block_list:JSON.stringify(hashes),rtype:1
    });
    if(!result.fs_id)throw new Error("TeraBox did not confirm the uploaded file.");
    return json({ok:true,path:result.path||path,file:{fs_id:String(result.fs_id),name:result.server_filename||"",size:Number(result.size||size)}});
  }catch(error){return json({error:error.message||"TeraBox could not finalize the upload"},502);}
}
