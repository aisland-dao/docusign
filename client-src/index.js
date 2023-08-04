import { web3Accounts, web3Enable, web3FromSource,isWeb3Injected } from '@polkadot/extension-dapp';
import qs from 'qs';
import EditorJS from '@editorjs/editorjs'; 
import NestedList from '@editorjs/nested-list';
import Underline from '@editorjs/underline';
import Strikethrough from '@sotaproject/strikethrough';

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { u8aToString } = require('@polkadot/util');
//const Header = require('@editorjs/header');
const Header = require("editorjs-header-with-alignment");
const Quote = require('@editorjs/quote');
const Delimiter = require('@editorjs/delimiter');
const Paragraph = require('editorjs-paragraph-with-alignment');
const ColorPlugin = require('editorjs-text-color-plugin');


let lastaccountidx=0;
let currentAccount='';
let currentToken='';
let dropArea;
let documentsJSON=[];
let currentDocumentId=0;
let actionsModal = new bootstrap.Modal('#documentActions', {focus: true})
let signDocumentModal = new bootstrap.Modal('#signDocument', {focus: true})



let signaturetoken='';
// check for token in session
const sessionToken=window.sessionStorage.getItem("currentToken");
const sessionAccount=window.sessionStorage.getItem("currentAccount");
console.log(sessionAccount);
if(sessionToken != null)
  currentToken=sessionToken;
if(sessionAccount != null){
  currentAccount=JSON.parse(sessionAccount);
  render_main('drafts');
}
// enable web3
enableWeb3()

// connect wallet button
document.getElementById("connect").onclick = () => {
  connectWallet();
};
// logout
document.getElementById("logout").onclick = () => {
  window.sessionStorage.clear();
};
// jump to templates
document.getElementById("menutemplates").onclick = () => {
  render_templates();
  // return false to avoid following the href
  return(false);
};

// actions on documents
// document view
document.getElementById("docview").onclick = () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    const params={
      account: currentAccount.address,
      token: currentToken,
      documentid: currentDocumentId
    }
    let url = window.location.protocol + "//" + window.location.host+"/docview";
    url=url+`?${qs.stringify(params)}`;
    window.open(url);
  }
};
// actions on documents
// document download
document.getElementById("docdownload").onclick = () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    const params={
      account: currentAccount.address,
      token: currentToken,
      documentid: currentDocumentId
    }
    let url = window.location.protocol + "//" + window.location.host+"/docdownload";
    url=url+`?${qs.stringify(params)}`;
    window.open(url);
  }
}
// actions on documents
// document renaming
document.getElementById("docrename").onclick = () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    // set input field on description
    let c='<input type="text" size="32" maxlength="64" id="docrename" value="'+docdata.description+'">';
    c=c+' <button type="button" class="btn btn-secondary" id="docwrite"><i class="bi bi-pencil-square"></i></button>'
    document.getElementById("D"+currentDocumentId).innerHTML = c;
    // temporary remove the click listener from the interested row
    const r=document.getElementById("r"+currentDocumentId);
    r.removeEventListener('click',documentactions,{ capture: true });
    // hide the modal
    actionsModal.hide();
    // set focus on the field
    document.getElementById("D"+currentDocumentId).focus();
    // add listener for Keypress on the description input
    const docwrite=document.getElementById("docwrite");
    docwrite.addEventListener('click',writeDocumentDescription);
  }
}
// actions on documents
// document editing (only for dcs files)
document.getElementById("docedit").onclick = async () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    // check file name with extension .dcs for online editing
    if(docdata.originalfilename.slice(-4)!='.dcs')
      return;
    // fetch document content from server
    const params={
      account: currentAccount.address,
      token: currentToken,
      documentid: currentDocumentId
    }
    let url = window.location.protocol + "//" + window.location.host+"/docdownload";
    const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
    let answerJSON = await  response.json();
    //console.log("answerJSON: ", answerJSON);
    actionsModal.hide();
    if(answerJSON.answer=='KO'){
      let msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+answerJSON.message;
      msg=msg+"</center></div>";
      document.getElementById("msg").innerHTML = msg;
      return;
    }
    render_editor_document(answerJSON);
    return;
  }
}
// actions on documents
// document delete
document.getElementById("docdelete").onclick = async () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    //we can delete only documents in draft
    if(docdata.status!='draft')
      return;
    let text='Do you confirm the cancellation of "'+docdata.description+'"?\nThe operation is irreversible'
    if (confirm(text) == true) {
          const params={
            account: currentAccount.address,
            token: currentToken,
            documentid: currentDocumentId
          }
          let url = window.location.protocol + "//" + window.location.host+"/docdelete";
          const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
          let answerJSON = await  response.json();
          console.log("answerJSON: ", answerJSON);
          if(answerJSON.answer=='KO'){
            let msg='<div class="alert alert-danger" role="alert"><center>';
            msg=msg+answerJSON.message;
            msg=msg+"</center></div>";
            document.getElementById("msg").innerHTML = msg;
            return;
          }
          actionsModal.hide();
          render_main('drafts')
      }
  }
}
// actions on documents
// document sign
document.getElementById("docsign").onclick = async () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    //we can sign document in waiting or draft status
    if(docdata.status!='draft' && docdata.status!='waiting')
      return;
    // hide the current modal
    actionsModal.hide();
    // set the data in the table
    document.getElementById("docsigndescription").innerHTML = docdata.description;
    document.getElementById("docsignfilename").innerHTML = docdata.originalfilename;
    const sn=Math.round(docdata.size/1024);
    const s=sn.toLocaleString('en-US');
    document.getElementById("docsignsize").innerHTML = s+" kb";
    let ac=docdata.account;
    ac=ac.substr(0,5)+"..."+ac.substr(43);
    document.getElementById("docsigncounterparts").innerHTML = ac;
    document.getElementById("docsignmsg").innerHTML ="";
    // show the signing modal
    signDocumentModal.show();
  }
}
// we update the UI fro drafts tab in case of dismiss button
document.getElementById("docsigndismiss").onclick = async () => {
  console.log("dismiss button has been pressed");
  render_main('waiting');
}


// actions on documents
// document reject
document.getElementById("docreject").onclick = async () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    //we can delete only documents in draft
    if(docdata.status!='waiting')
      return;
    let text='Do you confirm the rejection of "'+docdata.description+'"?\nThe operation is irreversible'
    if (confirm(text) == true) {
          const params={
            account: currentAccount.address,
            token: currentToken,
            documentid: currentDocumentId
          }
          let url = window.location.protocol + "//" + window.location.host+"/docreject";
          const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
          let answerJSON = await  response.json();
          console.log("answerJSON: ", answerJSON);
          if(answerJSON.answer=='KO'){
            let msg='<div class="alert alert-danger" role="alert"><center>';
            msg=msg+answerJSON.message;
            msg=msg+"</center></div>";
            document.getElementById("msg").innerHTML = msg;
            return;
          }
          actionsModal.hide();
          render_main('waiting');
      }
  }
}
// actions on documents
// document doclink
document.getElementById("doclink").onclick = async () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    console.log("docdata",docdata);
    //check status
    if(docdata.status!='draft' && docdata.status!='waiting'){
      console.log("returning for status not matching");
      return;
    }
    //fetch the signature token
    const params={
      account: currentAccount.address,
      token: currentToken,
      documentid: currentDocumentId
    }
    let url = window.location.protocol + "//" + window.location.host+"/doclink";
    const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
    let answerJSON = await  response.json();
    console.log("answerJSON: ", answerJSON);
    if(answerJSON.answer=='KO'){
      let msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+answerJSON.message;
      msg=msg+"</center></div>";
      document.getElementById("msg").innerHTML = msg;
      return;
    }
    actionsModal.hide();
    url=window.location.protocol + "//" + window.location.host+"/sign/?signaturetoken="+answerJSON.signaturetoken;
    render_main('waiting');
    const text="This is the signing url to share with your counterpart:";
    prompt(text,url);
  }
}
// document sign reject
document.getElementById("docsignreject").onclick = async () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    //we can delete only documents in draft
    if(docdata.status!='waiting')
      return;
    let text='Do you confirm the rejection of "'+docdata.description+'"?\nThe operation is irreversible'
    if (confirm(text) == true) {
          const params={
            account: currentAccount.address,
            token: currentToken,
            documentid: currentDocumentId
          }
          let url = window.location.protocol + "//" + window.location.host+"/docreject";
          const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
          let answerJSON = await  response.json();
          console.log("answerJSON: ", answerJSON);
          if(answerJSON.answer=='KO'){
            let msg='<div class="alert alert-danger" role="alert"><center>';
            msg=msg+answerJSON.message;
            msg=msg+"</center></div>";
            document.getElementById("msg").innerHTML = msg;
            return;
          }
          signDocumentModal.hide();
          render_main('rejected');
      }
  }
}
// actions on documents
// document view
document.getElementById("docsignview").onclick = () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    const params={
      account: currentAccount.address,
      token: currentToken,
      documentid: currentDocumentId
    }
    let url = window.location.protocol + "//" + window.location.host+"/docview";
    url=url+`?${qs.stringify(params)}`;
    window.open(url);
  }
};
// actions on documents
// document sign
document.getElementById("docsignsign").onclick = async () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    // info message
    let msg='<div class="alert alert-info" role="alert"><center>';
    msg=msg+"Connecting...";
    msg=msg+"</center></div>";
    document.getElementById("docsignmsg").innerHTML = msg;
    // connect to the node
    const provider = new WsProvider('wss://testnet.aisland.io');
    const api = await ApiPromise.create({ provider });
    // Retrieve the chain & node information information via rpc calls
    const [chain, nodeName, nodeVersion] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version()
    ]);
    msg='<div class="alert alert-info" role="alert"><center>';
    msg=msg+`You are connected to ${chain} using ${nodeName} v${nodeVersion}`;
    msg=msg+"</center></div>";
    document.getElementById("docsignmsg").innerHTML = msg;
    console.log("currentAccount",currentAccount);
    const injector = await web3FromSource(currentAccount.meta.source);
    console.log("docdata",docdata);
    if(currentAccount.address==docdata.account){
        //check for document already signed
        const hash = await api.query.docuSign.documents(docdata.account,currentDocumentId);
        const hashstring=`${hash}`
        //console.log("hash",hash);
        //console.log("hashstring",hashstring);
        if(hashstring!=='0x'){
            msg='<div class="alert alert-warning" role="alert"><center>';
            msg=msg+"Document already signed";
            msg=msg+"</center></div>";
            document.getElementById("docsignmsg").innerHTML = msg;
            return;
        }
    }else {
        //check for document already signed
        console.log("currentAccount.address ",currentAccount.address,"currentDocumentId ",currentDocumentId);
        const hash = await api.query.docuSign.signatures(currentAccount.address,currentDocumentId);
        const hashstring=`${hash}`
        //console.log("hash",hash);
        //console.log("hashstring",hashstring);
        if(hashstring!=='0x'){
            msg='<div class="alert alert-warning" role="alert"><center>';
            msg=msg+"Document already signed";
            msg=msg+"</center></div>";
            document.getElementById("docsignmsg").innerHTML = msg;
            return;
        }
    }
    if(currentAccount.address!=docdata.account){
        //update counterpart on the document table
        const params ={
          account: currentAccount.address,
          token: currentToken,
          documentaccount: docdata.account,
          documentid: currentDocumentId,
        }
        let url = window.location.protocol + "//" + window.location.host+"/updatedocumentcounterpart";
        const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
        let answerJSON = await  response.json();
        console.log("answerJSON: ", answerJSON);
        if(answerJSON.answer=='KO'){
          let msg='<div class="alert alert-danger" role="alert"><center>';
          msg=msg+answerJSON.message;
          msg=msg+"</center></div>";
          document.getElementById("msg").innerHTML = msg;
          return;
        }
   }
    //sign the document
    let signdocument;
    console.log()
    if(currentAccount.address==docdata.account){
      // proceed with the signature
      signdocument=api.tx.docuSign.newDocument(currentDocumentId,'0x'+docdata.hash);
    }else{
      signdocument=api.tx.docuSign.signDocument(currentDocumentId,'0x'+docdata.hash);
    }

    //const transferExtrinsic = api.tx.balances.transfer('5C5555yEXUcmEJ5kkcCMvdZjUo7NGJiQJMS7vZXEeoMhj3VQ', 123456);
    signdocument.signAndSend(currentAccount.address, { signer: injector.signer }, ({ status }) => {
      if (status.isInBlock) {
          msg='<div class="alert alert-info" role="alert"><center>';
          //msg=msg+`Tx Completed at block hash #${status.asInBlock.toString()}`;
          msg=msg+`Tx has been accepted, finalizing....`;
          msg=msg+"</center></div>";
          document.getElementById("docsignmsg").innerHTML = msg;
      } else {
          msg='<div class="alert alert-info" role="alert"><center>';
          msg=msg+`Current Tx status: ${status.type}`;
          msg=msg+"</center></div>";
          document.getElementById("docsignmsg").innerHTML = msg;
          console.log("status.type",status.type);
          if(status.type=='Finalized')
              signDocumentModal.hide;
      }
    }).catch((error) => {
      msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+` Tx failed: ${error}`;
      msg=msg+"</center></div>";
      document.getElementById("docsignmsg").innerHTML = msg;
    });

  }
};
//function to write the document description
async function writeDocumentDescription(){
  //get new description
  const desc=document.getElementById("docrename").value;
  if(desc.length>1){
    //update the description
    const params ={
      account: currentAccount.address,
      token: currentToken,
      documentid: currentDocumentId,
      description: desc
    }
    let url = window.location.protocol + "//" + window.location.host+"/updatedocumentdescription";
    const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
    let answerJSON = await  response.json();
    console.log("answerJSON: ", answerJSON);
    if(answerJSON.answer=='KO'){
      let msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+answerJSON.message;
      msg=msg+"</center></div>";
      document.getElementById("msg").innerHTML = msg;
    }
    let c=desc;
    // remove temporary listener
    const docwrite=document.getElementById("docwrite");
    docwrite.removeEventListener('click',writeDocumentDescription);
    // replace input field with the description changed
    document.getElementById("D"+currentDocumentId).innerHTML = c;
    // add again the listener for the "actions" 
    const r=document.getElementById("r"+currentDocumentId);
    r.addEventListener('click',documentactions,{ capture: true });
  }
}
// function to view a document in the browser
//function called to connect the wallet
async function connectWallet(){
    //console.log("Extension on page:",isWeb3Injected);
    //fetch the injected wallet
    let allInjected = await web3Enable('docusign.aisland.io')
    //console.log("allInjected",allInjected);
    if(allInjected.length==0){
      //invite the user to install a wallet
      let msg='<div class="alert alert-warning" role="alert"><center>';
      msg=msg+'There is no wallet extension in your browser. Please install the <a href="https://polkadot.js.org/extension/" target="_blank">Polkadot Wallet Extension</a>';
      msg=msg+' or <a href="https://www.subwallet.app" target="_blank">Subwallet</a>.';

      msg=msg+"</center></div>";
      document.getElementById("msg").innerHTML = msg;
      return;
    }

    // returns an array of { address, meta: { name, source } }
    // meta.source contains the name of the extension that provides this account
    const allAccounts = await web3Accounts();
    //console.log("allAccounts",allAccounts);
    if(allAccounts.length==0){
      //invite the user to create an account
      let msg='<div class="alert alert-warning" role="alert"><center>';
      msg=msg+'There are no accounts in your wallet. Please create one and click the button again when done';
      msg=msg+"</center></div>";
      document.getElementById("msg").innerHTML = msg;
      return;
    }
    // replace the text of the connect button with the account shortened 
    console.log(allAccounts[lastaccountidx].address,allAccounts[lastaccountidx].meta.name);
    currentAccount=allAccounts[lastaccountidx];
    let shortaccount=allAccounts[lastaccountidx].meta.name+' ['+allAccounts[lastaccountidx].address.substring(0,5)+'...'+allAccounts[lastaccountidx].address.substring(43)+']';
    document.getElementById("connect").innerHTML=shortaccount;
    //remove messages if any
    document.getElementById("msg").innerHTML = "";
    // inform how to change account
    if(allAccounts.length>1){
      let msg='<div class="alert alert-success" role="alert"><center>';
      msg=msg+'Click again on the button for the next account';
      msg=msg+"</center></div>";
      document.getElementById("msg").innerHTML = msg;
      if(lastaccountidx<allAccounts.length-1){
        lastaccountidx=lastaccountidx+1;
      }else {
        lastaccountidx=0;
      }
    }
    // generate a random security token
    //To guarantee enough performance, implementations are not using a truly random number generator, but they are using a pseudo-random number generator seeded with a value with enough entropy. The pseudo-random number generator algorithm (PRNG) may vary across user agents, but is suitable for cryptographic purposes. https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
    let token=bytestohex(window.crypto.getRandomValues(new Uint8Array(32)));
    //console.log("token:",token);
    // finds an injector for an address
    const injector = await web3FromSource(currentAccount.meta.source);
    const signRaw = injector?.signer?.signRaw;
    if (!!signRaw) {
      // after making sure that signRaw is defined
      // we can use it to sign our message
      const { signature } = await signRaw({
          address: currentAccount.address,
          data: token,
          type: 'bytes'
      });
      //console.log("signature",signature);
      // submit the signature/account/token to the server
      const params ={
        account: currentAccount.address,
        data: token,
        signature: signature
      }
      let url = window.location.protocol + "//" + window.location.host+"/signin";
      const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
      let signinJSON = await  response.json();
      console.log("Signin: ", signinJSON);
      //check for approval 
      if(signinJSON.answer=='KO'){
        let msg='<div class="alert alert-danger" role="alert"><center>';
        msg=msg+signinJSON.message;
        msg=msg+"</center></div>";
        document.getElementById("msg").innerHTML = documentsJSON.description;
        return
      }
      //render the document list UI
      currentToken=token;
      // set a session variable
      window.sessionStorage.setItem("currentToken",currentToken);
      window.sessionStorage.setItem("currentAccount",JSON.stringify(currentAccount));

      render_main('drafts');

  }
}
// function to render the main user interface after sign-in
async function render_main(section){
  // read signature token
  signaturetoken=getCookie('signaturetoken');
  // force the waiting the first time
  let signaturetokenfirstview=getCookie('signaturetokenfirstview');
  console.log("signaturetoken",signaturetoken);
  console.log("signaturetokenfirstview",signaturetokenfirstview);
  if(signaturetokenfirstview==signaturetoken && signaturetoken.length>0){
    console.log("forcing waiting session");
    section='waiting';
    //clear the cookie used for the first view
    document.cookie = "signaturetokenfirstview=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }
  // title
  let c='<div class="row">';
  c=c+'<div class="col-8 pb-1" style="background-color:#D2E3FF" ><center><h2>Blockchain Documents Signing</h2></center></div>';
  //c=c+'<div class="col-4 pb-1" style="background-color:#D2E3FF" ><center><button type="button" class="btn btn-primary" id="createnew"><i class="bi bi-journal-plus"></i> Create New</button></center></div>';
  c=c+'<div class="col-4 pb-1" style="background-color:#D2E3FF" ><center>';
  c=c+'<div class="dropdown">';
  c=c+'<button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">'
  c=c+'<i class="bi bi-journal-plus"></i> Create New';
  c=c+'</button>';
  c=c+'<ul class="dropdown-menu">';
  c=c+'<li><a class="dropdown-item" href="#" id="blankdocument">Blank Document</a></li>';
  c=c+'<li><a class="dropdown-item" href="#" id="templates">Templates</a></li>';
  c=c+'<li><a class="dropdown-item" href="#" id="createnew">Upload</a></li>';
  c=c+'</ul>';
  c=c+'</div>';
  c=c+'</center></div>';

  c=c+'</div>';
  c=c+'<div id="msg"></div>';
  c=c+'<div class="row"><div class="col">';
  c=c+'<ul class="nav nav-pills nav-fill">';
  c=c+'<li class="nav-item">';
  c=c+'<a class="nav-link" id="drafts"  href="#"><i class="bi bi-journal"></i>  Drafts</a>';
  c=c+'</li>';
  c=c+'<li class="nav-item">';
  c=c+'<a class="nav-link" id="waiting" href="#"><i class="bi bi-journal-text"></i> Waiting</a>';
  c=c+'</li>';
  //c=c+'<li class="nav-item">';
  //c=c+'<a class="nav-link" id="actionrequired" href="#"><i class="bi bi-journal-bookmark"></i> Action Required</a>';
  //c=c+'</li>';
  c=c+'<li class="nav-item">';
  c=c+'<a class="nav-link" href="#" id="approved"><i class="bi bi-journal-check"></i> Approved</a>';
  c=c+'</li>';
  c=c+'<li class="nav-item">';
  c=c+'<a class="nav-link" id="rejected" href="#"><i class="bi bi-journal-x"></i> Rejected</a>';
  c=c+'</li>';
  c=c+'</ul>';
  c=c+'</div></div>';
  // fetch the documents 
  const params={
    token: currentToken,
    account: currentAccount.address,
  }
  // fetch data
  let url = window.location.protocol + "//" + window.location.host+"/documents"+section;
  const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
  documentsJSON = await  response.json();

  c=c+'<div class="row"><div class="col">';
  c=c+'<table class="table table-dark table-striped table-hover">';
  //c=c+'<table class="table table-primary table-striped table-hover">';
  //c=c+'<table class="table table-info table-striped table-hover">';
  c=c+'<tr><td>#</td><td>Description</td><td>File Name</td><td>Size</td><td>Last Update</td><td>Status</td></tr>';
  for(let i=0;i<documentsJSON.length;i++) {
    c=c+'<tr id="r'+documentsJSON[i].id+'">'
    c=c+'<td id="I'+documentsJSON[i].id+'">'+documentsJSON[i].id+'</td>';
    c=c+'<td id="D'+documentsJSON[i].id+'">'+documentsJSON[i].description+'</td>';
    c=c+'<td id="F'+documentsJSON[i].id+'">'+documentsJSON[i].originalfilename+'</td>';
    const sn=Math.round(documentsJSON[i].size/1024);
    const s=sn.toLocaleString('en-US');
    c=c+'<td id="K'+documentsJSON[i].id+'">'+s+' kb</td>';
    let dt=documentsJSON[i].dtlastupdate;
    dt=dt.replace('T',' ');
    dt=dt.replace('.000Z','');
    dt=dt.substring(0,16);
    c=c+'<td id="T'+documentsJSON[i].id+'">'+dt+'</td>';
    c=c+'<td id="S'+documentsJSON[i].id+'">'+documentsJSON[i].status+'</td>';
    c=c+'</tr>';
  }
  c=c+'</table>';
  c=c+'</div></div>';
  // show cards option if empty
  if(documentsJSON.length==0){
    c=c+'<div class="row  justify-content-center align-items-center" style="text-align: center">';
    c=c+'<div class="col-12"><h4>*** No documents found ***</h4><hr>';
    c=c+'</div></div>';
    c=c+'<div class="row  justify-content-center align-items-center" style="text-align: center">';
    c=c+'<div class="col-3">';
    c=c+'<div class="card" style="width: 15rem">';
    //c=c+'<div class="card">';
    c=c+'<img src="img/blank-document.svg" class="card-img-top" alt="Blank Document" height="50" style="Padding:2px">';
    c=c+'<div class="card-body">';
    c=c+'<h5 class="card-title">Blank Document</h5>';
    c=c+'<p class="card-text">You can create a blank document and use the inline block editor to create your agreement. The system keep a version of the different drafts till the signature.</p>';
    c=c+'<button type="button" class="btn btn-primary" id="create-blank">Create</button>';
    c=c+'</div>';
    c=c+'</div>';
    c=c+'<p></p>';
    c=c+'</div>';
    c=c+'<div class="col-3">';
    c=c+'<div class="card" style="width: 15rem;">';
    //c=c+'<div class="card">';
    c=c+'<img src="img/templates-document.svg" class="card-img-top" alt="Templates" height="50" style="Padding:2px">';
    c=c+'<div class="card-body">';
    c=c+'<h5 class="card-title">Templates</h5>';
    c=c+'<p class="card-text">You can create a document from one of the public template, create yours private template and reuse and even make a public one an be rewarded for your contribution.</p>';
    c=c+'<button type="button" class="btn btn-primary" id="select-template">Select</button>';
    c=c+'</div>';
    c=c+'</div>';
    c=c+'<p></p>';
    c=c+'</div>';
    c=c+'<div class="col-3">';
    c=c+'<div class="card" style="width: 15rem;">';
    //c=c+'<div class="card">';
    c=c+'<img src="img/upload-document.svg" class="card-img-top" alt="Upload"  height="50" style="Padding:2px">';
    c=c+'<div class="card-body">';
    c=c+'<h5 class="card-title">Upload</h5>';
    c=c+'<p class="card-text">You can upload the document to be signed, the supported format are: pdf, png, jpeg, doc, docx (Microsoft Word),odf,odc (Open Office).Preview is supported.</p>';
    c=c+'<button type="button" class="btn btn-primary" id="upload-document">Upload</button>';
    c=c+'</div>';
    c=c+'</div>';
    c=c+'<p></p>';
    c=c+'</div>';
    c=c+'</div>';
  }
  
  document.getElementById("root").innerHTML =c;
  //console.log(c);
  // connect events for the tabs
  const drafts=document.getElementById("drafts");  
  drafts.addEventListener('click', render_drafts, false);    
  const approved=document.getElementById("approved");  
  approved.addEventListener('click', render_approved, false);    
  const waiting=document.getElementById("waiting");  
  waiting.addEventListener('click', render_waiting, false);    
  //const actionrequired=document.getElementById("actionrequired");  
  //actionrequired.addEventListener('click', render_actionrequired, false);    
  const rejected=document.getElementById("rejected");  
  rejected.addEventListener('click', render_rejected, false);    
  // connect the button to the rendering UI function
  document.getElementById("createnew").onclick = () => {render_file_upload();};
  // connect the button to the editing of an empty document
  document.getElementById("blankdocument").onclick = () => {render_editor_document();};
  // connect the button to the templates management
  document.getElementById("templates").onclick = () => {render_templates();};
  // set active tab
  document.getElementById(section).className = "nav-link active";
  // connect events for the documents in the table
  for(let i=0;i<documentsJSON.length;i++) {
    const r=document.getElementById("r"+documentsJSON[i].id);
    r.addEventListener('click',documentactions,{ capture: true });
  }
  // connect events for cards
  if(documentsJSON.length==0){
    document.getElementById("upload-document").onclick = () => {render_file_upload();};
    // connect the button to the editing of an empty document
    document.getElementById("create-blank").onclick = () => {render_editor_document();};
    // connect the button to the templates management
    document.getElementById("select-template").onclick = () => {render_templates();};
  }
  // return false to avoid that click on href are executed
  return(false); // to avoid that click on href are executed
}
// function to show the action menu
async function documentactions(e){
  // get the document id
  const id=e.srcElement.id.substring(1);
  console.log("id",id);
  // update global variable to keep a mark on the current document
  currentDocumentId=id;
  //render a modal
  const d= await get_document_data(id);
  document.getElementById("documentActionsLabel").innerHTML =d.description;
  //open the modal 
  //actionsModal = new bootstrap.Modal('#documentActions', {focus: true})
  actionsModal.show();

}
function get_document_data(id){
  for(let i=0;i<documentsJSON.length;i++){
    if(documentsJSON[i].id==id)
      return(documentsJSON[i]);
  }
  return({})
}
//functions to render the different status since we cannot
function render_drafts(){
  render_main("drafts");
}
function render_waiting(){
  render_main("waiting");
}
function render_actionrequired(){
  render_main("actionrequired");
}
function render_approved(){
  render_main("approved");
}
function render_rejected(){
  render_main("rejected");
}
// function to upload the file
function uploadFile(file) {
  let url = window.location.protocol + "//" + window.location.host+"/upload";
  let formData = new FormData();
  console.log("file:",file);
  formData.append('files', file);
  formData.append('account', currentAccount.address);
  formData.append('token', currentToken);
  fetch(url, {
    method: 'POST',
    body: formData,
  })
  .then(async (answer) => { 
    let answerJSON = await  answer.json();
    console.log("Upload has been completed",answerJSON);
    let msg='<div class="alert alert-success" role="alert"><center>';
    msg=msg+'Documents have been uploaded successfully';
    msg=msg+"</center></div>"; 
    document.getElementById("msg").innerHTML =msg;
    return;
  })
  .catch((e) => { 
    console.log("error during the upload",e)
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+"Error during the upload, please retry later...."
    msg=msg+"</center></div>";
    document.getElementById("msg").innerHTML = msg;
   });
}
// functiont to manage the dropped files
function handleDrop(e) {
  let dt = e.dataTransfer;
  let files = dt.files;
  handleFiles(files);
}
// function to call the upload file for each file dropped
function handleFiles(files) {
  let fileElem=document.getElementById('fileElem');
  ([...files]).forEach(uploadFile);
  // render main UI after the upload is completed
  render_main('drafts');
}


// functions to prevent defauls in dragging events
function preventDefaults (e) {
  e.preventDefault()
  e.stopPropagation()
}
// functions to highlit the drop area
function highlight(e) {
  dropArea.classList.add('highlight')
}
function unhighlight(e) {
  dropArea.classList.remove('highlight')
}


//function to render the file upload UI
function render_file_upload(){
  let c='<div class="row">';
  c=c+'<div class="col-12 pb-1" style="background-color:#D2E3FF" ><center><h2>Upload Documents</h2></center></div>';
  c=c+'</div>';
  c=c+'<div class="row"><div class="col" id="msg">';
  c=c+'</div>';
  c=c+'</div>';
  c=c+'<div class="row"><div class="col">';
  c=c+'<div id="drop-area">';
  c=c+'<form class="test-form">';
  c=c+'<p>Upload multiple files with the file dialog or by dragging and dropping files onto the dashed region</p>';
  c=c+'<input type="file" id="fileElem" name="fileElem" accept=".doc,.docx,.pdf,.rtf,.odt,.ods,.odf,.txt" multiple>';
  c=c+'<label class="text" for="fileElem"> Drag and drop files here</label>';
  c=c+'</form>';
  c=c+'</div>';
  c=c+'</div>';
  c=c+'</div>';
  //console.log(c);
  document.getElementById("root").innerHTML =c;
  // setup events
  dropArea = document.getElementById('drop-area');
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  // file dropping handle
  dropArea.addEventListener('drop', handleDrop, false);
  // add file change event
  //let fileElem=document.getElementById('fileElem');
  //fileElem.addEventListener("change", handleFiles(fileElem.files));

}
//function to render a document UI
function render_editor_document(docdata){
  let c='<div class="row">';
  c=c+'<div class="col-12 pb-1" style="background-color:#D2E3FF" ><center><h2>'
  if(typeof docdata === 'undefined')
    c=c+'New Document';
  else
    c=c+'Editing Document';
  c=c+'</h2></center>';
  //button to save an
  c=c+' <button class="btn btn-primary" id="docsave">Save</button>';
  c=c+' <button class="btn btn-secondary" id="doccancel">Cancel</button>';
  c=c+'</div>';
  c=c+'</div>';
  c=c+'<div class="row"><div class="col" id="msg"></div></div>';
  c=c+'<div class="row"><div class="col">';
  c=c+'<div id="editorjs">';
  c=c+'</div>';
  c=c+'</div>';
  c=c+'</div>';
  // manage document data
  let documentdata={};
  if(typeof docdata !== 'undefined')
    documentdata=docdata;
  
  console.log("documentdata",documentdata);
  document.getElementById("root").innerHTML =c;
  // set border around edtior
  document.getElementById("editorjs").style.border = "solid #434545";
  // configure editor
  const editor =new EditorJS({
    holder: 'editorjs',
    autofocus: false,
    placeholder: 'Click here to start writing....',
    data: documentdata,
    tools: {
      header: {
        class: Header,
        shortcut: 'CMD+SHIFT+H',
        config: {
          placeholder: 'Enter a header',
          levels: [1, 2, 3, 4, 5, 6],
          defaultLevel: 3,
          defaultAlignment: 'left'
        }
      },
      list: {
        class: NestedList,
        inlineToolbar: true,
        config: {
          defaultStyle: 'ordered'
        },
      },
      quote: {
        class: Quote,
        inlineToolbar: true,
        shortcut: 'CMD+SHIFT+Q',
        config: {
          quotePlaceholder: 'Enter a quote',
          captionPlaceholder: 'Quote\'s author',
        },
      },
      delimiter: Delimiter,
      paragraph: {
        class: Paragraph,
        inlineToolbar: true,
      },  
      Color: {
        class: ColorPlugin, 
        config: {
           colorCollections: ['#EC7878','#9C27B0','#673AB7','#3F51B5','#0070FF','#03A9F4','#00BCD4','#4CAF50','#8BC34A','#CDDC39', '#FFF'],
           defaultColor: '#FF1300',
           type: 'text', 
           customPicker: true // add a button to allow selecting any colour  
        }     
      },
      Marker: {
        class: ColorPlugin, 
        config: {
           defaultColor: '#FFBF00',
           type: 'marker',
           icon: `<svg fill="#000000" height="200px" width="200px" version="1.1" id="Icons" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M17.6,6L6.9,16.7c-0.2,0.2-0.3,0.4-0.3,0.6L6,23.9c0,0.3,0.1,0.6,0.3,0.8C6.5,24.9,6.7,25,7,25c0,0,0.1,0,0.1,0l6.6-0.6 c0.2,0,0.5-0.1,0.6-0.3L25,13.4L17.6,6z"></path> <path d="M26.4,12l1.4-1.4c1.2-1.2,1.1-3.1-0.1-4.3l-3-3c-0.6-0.6-1.3-0.9-2.2-0.9c-0.8,0-1.6,0.3-2.2,0.9L19,4.6L26.4,12z"></path> </g> <g> <path d="M28,29H4c-0.6,0-1-0.4-1-1s0.4-1,1-1h24c0.6,0,1,0.4,1,1S28.6,29,28,29z"></path> </g> </g></svg>`
          }       
      },
      underline: Underline,
      strikethrough: Strikethrough,
    },
    
  });
  docsave.addEventListener('click',documentsave);
  docsave.param=editor;
  doccancel.addEventListener('click',documentcancel);
  doccancel.param=editor;
}
//function to save document
async function documentsave(evt){
  const editor=evt.currentTarget.param;
  let data= await editor.save();
  // in case of empyt doc leave without saving
  if(typeof data.blocks[0] === 'undefined'){
    render_main('drafts');
    return;
  }
  // require a description for the file
  let filename=prompt("Please insert a description for this document:","Draft");
  if(filename==null){
    return;
  }
  filename=filename+".dcs";
  data=JSON.stringify(data);
  //console.log("data",data);
  let url = window.location.protocol + "//" + window.location.host+"/upload";
  let formData = new FormData();
  const content = data;
  const blob = new Blob([content], { type: "text/json" });
  console.log("blob",blob);
  //formData.append("webmasterfile.dcs", blob);
  formData.append('files', blob,filename);
  formData.append('account', currentAccount.address);
  formData.append('token', currentToken);
  fetch(url, {
    method: 'POST',
    body: formData,
  })
  .then(async (answer) => { 
    let answerJSON = await  answer.json();
    console.log("Upload has been completed",answerJSON);
    let msg='<div class="alert alert-success" role="alert"><center>';
    msg=msg+'Documents have been uploaded successfully';
    msg=msg+"</center></div>"; 
    document.getElementById("msg").innerHTML =msg;
    render_main('drafts');
    return;
  })
  .catch((e) => { 
    console.log("error during the upload",e)
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+"Error during the upload, please retry later...."
    msg=msg+"</center></div>";
    document.getElementById("msg").innerHTML = msg;
   });

}
// cancel document editing
async function documentcancel(evt){
  let editor=evt.currentTarget.param;
  let data= await editor.save();
  if(typeof data.blocks[0] !== 'undefined'){
      const answer=confirm("Do you want to leave without saving?");
      if(answer==true){
        render_main('drafts');
        return;
      }
  }
  else {
    render_main('drafts');
    return;
  }
}
// function to convert bytes to hex 
function bytestohex(bytes) {
  var hexstring='', h;
  for(var i=0; i<bytes.length; i++) {
      h=bytes[i].toString(16);
      if(h.length==1) { h='0'+h; }
      hexstring+=h;
  }   
  return hexstring;
}
// function to read cookie value
function getCookie(name){
  var pattern = RegExp(name + "=.[^;]*");
  var matched = document.cookie.match(pattern);
  if(matched){
      var cookie = matched[0].split('=');
      return cookie[1];
  }
  return '';
}
//function to render templates management
async function render_templates(tagfilterv){
  // fetch tags
  let params={
    account: currentAccount.address,
    token: currentToken,
  }
  let url = window.location.protocol + "//" + window.location.host+"/templatestags";
  let response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
  let tags = await  response.json();
  let c='<div class="row">';
  c=c+'<div class="col-12 pb-1" style="background-color:#D2E3FF" ><center><h2>'
  c=c+'Templates';
  c=c+'</h2></center></div></div>';
  c=c+'<div class="row"><div class="col" id="msg"></div></div>';
  // tags
  c=c+'<div class="row"><div class="col" id="tags">'
  c=c+'<hr>&nbsp;&nbsp; Filter by:&nbsp;';
  let x=tags.length;
  let i=0;
  for(i=0;i<x;i++){
    c=c+'<span class="tag-cloud" id="tag'+i+'">'+tags[i]+'</span>&nbsp;'
  }
  c=c+'<hr></div></div>';
  // fetch templates
  params={
    account: currentAccount.address,
    token: currentToken,
  }
  url = window.location.protocol + "//" + window.location.host+"/templates";
  response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
  let templates = await  response.json();
  console.log(templates);
  // templates' listbox
  c=c+'<div class="row"><div class="col-1"> </div>'
  c=c+'<div class="col-10" id="templatelist">'
  c=c+'<select class="form-select" size="10" aria-label="size 10 select templates" id="templateslist">';
  for(i=0;i<x;i++){
    if(typeof tagfilterv==='undefined')
      c=c+'<option value="'+templates[i].id+'" >'+templates[i].description+'</option>';
    else{
      if(templates[i].tags.search(tagfilterv)> -1)
        c=c+'<option value="'+templates[i].id+'" >'+templates[i].description+'</option>';
    }
  }
  c=c+'</select>';
  c=c+'</div>';
  c=c+'<div class="col-1"> </div> </div>';
  //buttons to clone/cancel
  c=c+'<div class="row"><div class="col">';
  
  c=c+'<center><br><button class="btn btn-primary" id="templateclone">Clone</button> ';
  c=c+' <button class="btn btn-secondary" id="templatecancel">Cancel</button></center><br>';
  c=c+'</div>';
  c=c+'</div>';
  
  c=c+'<div class="row"><div class="col">';
  c=c+'<div id="templateview">';
  c=c+'</div>';
  c=c+'</div>';
  c=c+'</div>';
  document.getElementById("root").innerHTML =c;
  templateclone.addEventListener('click',templateClone);
  //docsave.param=editor;
  templatecancel.addEventListener('click',templateCancel);
  templateslist.addEventListener('click',showtemplate);
  // set listening for tags
  x=tags.length;
  for(i=0;i<x;i++){
    const tagname='tag'+i;
    const v=tagname+".addEventListener('click',tagfilter);"+tagname+'.param="'+tags[i]+'";';
    console.log(v);
    eval(v);
  }
}
// function to clone/edit the template
async function templateClone(){
  // read select id from
  let id=document.getElementById("templateslist").value;
  console.log("id",id);
  // fetch docdata of the template
  const params={
    account: currentAccount.address,
    token: currentToken,
    documentid: id,
  }
  const url = window.location.protocol + "//" + window.location.host+"/templatedata";
  let response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
  console.log("response",response);
  let data = await  response.json();
  console.log("data",data);
  render_editor_document(data);
  return;
}
// function to return to drafts from template cancellation
function templateCancel(){
  render_main('drafts');
  return;
}
// function to render the content of a template
async function showtemplate(){
  // read select id from
  let id=document.getElementById("templateslist").value;
  // fetch html of the template
  const params={
    account: currentAccount.address,
    token: currentToken,
    documentid: id,
  }
  const url = window.location.protocol + "//" + window.location.host+"/templateview";
  let response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
  console.log("response",response);
  let html = await  response.text();
  console.log("html",html);
  document.getElementById("templateview").innerHTML =html;
  document.getElementById("templateview").style.border = "solid #434545";
}
//function to filter thw template by tag
function tagfilter(evt){
  console.log("tagfilter",evt.currentTarget.param);
  render_templates(evt.currentTarget.param);
  return;
}
//function to enable web3
async function enableWeb3() {
    let allInjected = await web3Enable('docusign.aisland.io')
    //console.log("allInjected",allInjected);
    if(allInjected.length==0){
      //invite the user to install a wallet
      let msg='<div class="alert alert-warning" role="alert"><center>';
      msg=msg+'There is no wallet extension in your browser. Please install the <a href="https://polkadot.js.org/extension/" target="_blank">Polkadot Wallet Extension</a>';
      msg=msg+' or <a href="https://www.subwallet.app" target="_blank">Subwallet</a>.';

      msg=msg+"</center></div>";
      document.getElementById("msg").innerHTML = msg;
      return;
    }
}