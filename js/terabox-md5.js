/* Small browser-side MD5 helper used only for TeraBox's documented chunk checksums. */
(() => {
  "use strict";
  function md5(input){
    const bytes=input instanceof Uint8Array?input:new TextEncoder().encode(String(input));
    const bitLength=bytes.length*8,length=Math.ceil((bytes.length+9)/64)*64;
    const padded=new Uint8Array(length);padded.set(bytes);padded[bytes.length]=128;
    const view=new DataView(padded.buffer);view.setUint32(length-8,bitLength>>>0,true);view.setUint32(length-4,Math.floor(bitLength/4294967296),true);
    const shifts=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    const k=Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0);
    let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
    for(let offset=0;offset<length;offset+=64){
      const words=Array.from({length:16},(_,i)=>view.getUint32(offset+i*4,true));
      let a=a0,b=b0,c=c0,d=d0;
      for(let i=0;i<64;i++){
        let f,g;
        if(i<16){f=(b&c)|(~b&d);g=i;}
        else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;}
        else if(i<48){f=b^c^d;g=(3*i+5)%16;}
        else{f=c^(b|~d);g=(7*i)%16;}
        const sum=(a+f+k[i]+words[g])>>>0,shift=shifts[i];
        const rotated=((sum<<shift)|(sum>>>(32-shift)))>>>0,next=(b+rotated)>>>0;
        a=d;d=c;c=b;b=next;
      }
      a0=(a0+a)>>>0;b0=(b0+b)>>>0;c0=(c0+c)>>>0;d0=(d0+d)>>>0;
    }
    return [a0,b0,c0,d0].map(word=>[word&255,(word>>>8)&255,(word>>>16)&255,(word>>>24)&255].map(v=>v.toString(16).padStart(2,"0")).join("")).join("");
  }
  window.VH_MD5_BLOB=async blob=>md5(new Uint8Array(await blob.arrayBuffer()));
})();
