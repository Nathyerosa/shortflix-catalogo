// Capture a one-time Firebase email action before loading application assets.
// Ignore the public Firebase apiKey: identity is always checked by our server.
(()=>{
 const params=new URLSearchParams(location.search);
 if(!params.has('oobCode')&&!params.has('apiKey'))return;
 const kind=params.get('mode'),code=params.get('oobCode');
 let target='#/catalogo';
 try{
  const next=new URL(params.get('continueUrl')||'',location.origin);
  if(next.origin===location.origin){
   const [path,query]=next.hash.split('?');
   const id=new URLSearchParams(query||'').get('serie');
   if(path==='#/conta/retorno'&&/^mini_[a-f0-9]{12}$/.test(id||''))target='#/serie/'+id;
  }
 }catch{}
 let action=(['verifyEmail','resetPassword'].includes(kind)&&/^[A-Za-z0-9_-]{10,2048}$/.test(code||''))?{kind,code,target}:{invalid:true,target};
 // Remove action secrets from the address/history immediately. Never persist them.
 history.replaceState(null,'',location.pathname+'#/conta/acao'+(target.startsWith('#/serie/')?'?serie='+target.slice(8):''));
 Object.defineProperty(window,'shortflixConsumeEmailAction',{configurable:true,value:()=>{const current=action;action=null;return current;}});
})();
