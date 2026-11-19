import {json,requirePrimaryAdmin,getFreshTeraBoxConnection} from "../../../lib/terabox.js";
export async function onRequestGet({request,env}){
  const auth=await requirePrimaryAdmin(request,env);if(auth.response)return auth.response;
  try{
    const connection=await getFreshTeraBoxConnection(env);
    if(!connection)return json({connected:false});
    const url=new URL("/openapi/api/quota",connection.api_domain);
    url.searchParams.set("access_tokens",connection.access_token);
    const response=await fetch(url.toString());
    const payload=await response.json();
    if(!response.ok||Number(payload.errno||0)!==0)throw new Error(payload.show_msg||"TeraBox quota lookup failed.");
    return json({connected:true,account_id:connection.account_id,total_bytes:Number(payload.total||0),used_bytes:Number(payload.used||0)});
  }catch(error){return json({connected:false,error:error.message||"TeraBox status unavailable"},502);}
}
