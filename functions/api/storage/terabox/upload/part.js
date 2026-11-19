import {json,requireContentStaff,getFreshTeraBoxConnection,teraboxFolder} from "../../../../lib/terabox.js";
export async function onRequestPost({request,env}){
  const auth=await requireContentStaff(request,env);if(auth.response)return auth.response;
  try{
    const data=await request.formData();
    const path=String(data.get("path")||""),uploadid=String(data.get("uploadid")||"");
    const partseq=Number(data.get("partseq")),file=data.get("file");
    if(!path.startsWith(teraboxFolder(env))||path.includes(".."))return json({error:"Invalid TeraBox upload path"},400);
    if(!uploadid||uploadid.length>2048||!Number.isInteger(partseq)||partseq<0||!file||typeof file.arrayBuffer!=="function")return json({error:"Invalid upload chunk"},400);
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
    return json({ok:true,partseq,md5:payload.md5||null});
  }catch(error){return json({error:error.message||"TeraBox chunk upload failed"},502);}
}
