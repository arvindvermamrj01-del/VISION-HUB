import {json,requireContentStaff,getFreshTeraBoxConnection,teraboxFolder,verifyTeraBoxUploadToken} from "../../../../lib/terabox.js";
export async function onRequestPost({request,env}){
  const auth=await requireContentStaff(request,env);if(auth.response)return auth.response;
  try{
    const data=await request.formData();
    const uploadToken=String(data.get("upload_token")||"");
    const partseq=Number(data.get("partseq")),file=data.get("file"),expectedMd5=String(data.get("expected_md5")||"");
    let session;try{session=await verifyTeraBoxUploadToken(uploadToken,env);}catch(_){return json({error:"TeraBox upload token is invalid or expired"},401);}
    if(session.uid!==auth.user.id)return json({error:"TeraBox upload session belongs to another user"},403);
    const path=String(session.path||""),uploadid=String(session.uploadid||"");
    if(!path.startsWith(teraboxFolder(env))||path.includes(".."))return json({error:"Invalid TeraBox upload path"},400);
    if(!uploadid||uploadid.length>2048||!Number.isInteger(partseq)||partseq<0||!(/^[a-f0-9]{32}$/i.test(expectedMd5))||!file||typeof file.arrayBuffer!=="function")return json({error:"Invalid upload chunk"},400);
    if(file.size<1||file.size>10*1024*1024)return json({error:"Each upload chunk must be 1 byte to 10 MiB"},400);
    const connection=await getFreshTeraBoxConnection(env);if(!connection)return json({error:"TeraBox account is not connected"},409);
    const target=new URL("/rest/2.0/pcs/superfile2",connection.upload_domain);
    target.searchParams.set("method","upload");target.searchParams.set("app_id","250528");
    target.searchParams.set("path",path);target.searchParams.set("uploadid",uploadid);
    target.searchParams.set("partseq",String(partseq));target.searchParams.set("access_tokens",connection.access_token);
    const form=new FormData();form.set("file",file,file.name||"chunk.bin");
    const response=await fetch(target.toString(),{method:"POST",body:form});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||Number(payload.errno||0)!==0)throw new Error(payload.show_msg||"TeraBox chunk upload failed.");
    if(String(payload.md5||"").toLowerCase()!==expectedMd5.toLowerCase())throw new Error("TeraBox chunk checksum mismatch; retry this upload.");
    return json({ok:true,partseq,md5:payload.md5});
  }catch(error){return json({error:error.message||"TeraBox chunk upload failed"},502);}
}
