import {json,requireContentStaff,getFreshTeraBoxConnection,postForm,teraboxFolder,signTeraBoxUploadToken,hashUploadList} from "../../../../lib/terabox.js";
export async function onRequestPost({request,env}){
  const auth=await requireContentStaff(request,env);if(auth.response)return auth.response;
  let body;try{body=await request.json();}catch(_){return json({error:"Invalid JSON"},400);}
  const name=String(body.file_name||"").split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g,"").replace(/[^a-zA-Z0-9._() -]/g,"_").slice(0,160);
  const size=Number(body.size||0),hashes=body.block_md5s;
  if(!name||!Number.isSafeInteger(size)||size<=0)return json({error:"A valid filename and file size are required"},400);
  if(!Array.isArray(hashes)||hashes.length<1||hashes.length>10000||hashes.some(x=>!/^[a-f0-9]{32}$/i.test(String(x))))return json({error:"Invalid TeraBox chunk hash list"},400);
  try{
    const connection=await getFreshTeraBoxConnection(env);if(!connection)return json({error:"Connect the primary Admin TeraBox account first."},409);
    const path=teraboxFolder(env)+Date.now()+"_"+name;
    const result=await postForm(connection.api_domain+"/openapi/api/precreate?access_tokens="+encodeURIComponent(connection.access_token),{
      path,autoinit:1,block_list:JSON.stringify(hashes)
    });
    if(Number(result.return_type)===2)return json({already_exists:true,path,file:result.info||null});
    if(!result.uploadid||!Array.isArray(result.block_list))throw new Error("TeraBox pre-upload returned an incomplete upload session.");
    const requestedParts=result.block_list.length?result.block_list:[0];
    const uploadToken=await signTeraBoxUploadToken({uid:auth.user.id,exp:Date.now()+6*60*60*1000,path,uploadid:result.uploadid,hashes_digest:await hashUploadList(hashes)},env);
    return json({path,upload_token:uploadToken,parts:requestedParts.map(Number)});
  }catch(error){return json({error:error.message||"TeraBox upload could not be initialized"},502);}
}
