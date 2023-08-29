import { web3Accounts, web3Enable, web3FromAddress} from '@polkadot/extension-dapp';
import qs from 'qs';
import EditorJS from '@editorjs/editorjs'; 
import NestedList from '@editorjs/nested-list';
import Underline from '@editorjs/underline';
import Strikethrough from '@sotaproject/strikethrough';

//from polkadot.js
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { hexToU8a,u8aToHex, isHex,u8aToString,u8aToBuffer } = require('@polkadot/util');
const { decodeAddress, encodeAddress } = require('@polkadot/keyring');

//for encryption/decryption
const {mnemonicGenerate,mnemonicToMiniSecret} = require('@polkadot/util-crypto');
const { Keyring }=require('@polkadot/keyring');
const _sodium =require('libsodium-wrappers-sumo');
/*
const  {encrypt_asymmetric_stream,
        decrypt_asymmetric_stream,
        encrypt_symmetric_stream,
        decrypt_symmetric_stream
} = require('../modules/cryptostream.js');
*/
//const crypto = require('crypto').webcrypto;


// conversion utilities
const {
  bytestohex,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  uint8ArrayToBase64,
  base64ToUint8Array,
  arrayBufferToString
}=require("../modules/utility.js");

//from editor.js
const Header = require("editorjs-header-with-alignment");
const Quote = require('@editorjs/quote');
const Delimiter = require('@editorjs/delimiter');
const Paragraph = require('editorjs-paragraph-with-alignment');
const ColorPlugin = require('editorjs-text-color-plugin');
// load custom plugin used for the signature inside the editor.js
import Signature from '../editorjs-signature-plugin/signature.js'

//for binary serialization
const { unpack, pack } = require('msgpackr');


//***********************************************************
// ** you may change this to your blockchain
//***********************************************************
const BLOCKCHAINENDPOINT='wss://testnet.aisland.io'
//***********************************************************
// assign crypto variable
let lastaccountidx=0;
let currentAccount='';
let currentToken='';
let dropArea;
let documentsJSON=[];
let currentDocumentId=0;
let actionsModal = new bootstrap.Modal('#documentActions', {focus: true})
let signDocumentModal = new bootstrap.Modal('#signDocument', {focus: true})
let fontsFlag=false;  //used to avoid multiple loading of the fonts
let nrFonts=0;        // the number of fonts loaded
let fonts=[];         // fonts array loaded from disk
let encryptedprivatekey; //encrypted private key
let encryptionpwd=''; //encryption password
let api;    //used for the connection to the node


let signaturetoken='';

// check for token in session
const sessionToken=window.sessionStorage.getItem("currentToken");
const  sessionAccount=window.sessionStorage.getItem("currentAccount");
let publicsignaturetoken=window.sessionStorage.getItem("publicsignaturetoken");
if(sessionToken != null)
  currentToken=sessionToken;
if(sessionAccount != null){
  currentAccount=JSON.parse(sessionAccount);
  render_main('drafts');
}
// enable web3 functions, it's a call required
await enableWeb3()
// enable tooltip
const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

// Here we set the actions of the different menu/buttons/links
if(typeof document.getElementById("connect") !== 'undefined' &&
    document.getElementById("connect")!=null ){
    // connect wallet button
    //document.getElementById("connect").onclick = () => {
    //  connectWallet();
    //};
    const connectwallet=document.getElementById("connect");
    connectwallet.addEventListener('click',connectWallet);
}
// logout, remove all the session data
document.getElementById("logout").onclick = () => {
  window.sessionStorage.removeItem("currentToken");
  window.sessionStorage.removeItem("currentAccount");
  window.sessionStorage.removeItem("publicsignaturetoken");
  window.sessionStorage.clear();
  const home=window.location.protocol + "//" + window.location.host;
  window.location.reload(home);
  
};
// jump to templates rendering
document.getElementById("menutemplates").onclick = () => {
  render_templates();
  // return false to avoid following the href
  return(false);
};
// jump to settings rendering, the settings has multiple tabs
document.getElementById("menusettings").onclick = () => {
  render_settings();
  // return false to avoid following the href
  return(false);
};

// actions on documents
// document view
document.getElementById("docview").onclick = async () => {
  if(currentDocumentId>0){
    const blob = await api.query.docSig.blobs(currentAccount.address,currentDocumentId,1);
    if(blob.length>0){
      let docUrl= await download_blob(blob);
      // download the file
      window.open(docUrl);
      return;
    }else {
      const params={
        account: currentAccount.address,
        token: currentToken,
        documentid: currentDocumentId
      }

      let url = window.location.protocol + "//" + window.location.host+"/docview";
      url=url+`?${qs.stringify(params)}`;
      window.open(url);
    }
  }
};
// actions on documents
// document download
document.getElementById("docdownload").onclick = async () => {
  if(currentDocumentId>0){
    //check for blob available on chain
    const blob = await api.query.docSig.blobs(currentAccount.address,currentDocumentId,1);
    if(blob.length>0){
      let docUrl= await download_blob(blob);
      let docdata=get_document_data(currentDocumentId);
      // download the file
      const link = document.createElement('a');
      link.href = docUrl;
      link.download = docdata.originalfilename;
      link.click();
      return;
    }else {
      // download from the server in case it's not stored on chain
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
    actionsModal.hide();
    if(answerJSON.answer=='KO'){
      await show_error(answerJSON.message);
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
          if(answerJSON.answer=='KO'){
            await show_error(answerJSON.message);
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
    let ac=currentAccount.address;
    ac=ac.substr(0,6)+"..."+ac.substr(42);
    document.getElementById("docsignmycounterpart").innerHTML = ac;
    let cp='';
    if(docdata.account==currentAccount.address){
      // add field for counterpart account (we need it now to encrypt the document for the counterpart)
      cp='<input class="form-control" type="text" placeholder="Address" aria-label="default input fullname" id="counterpart" value="'+docdata.counterpart+'" required >';  
    }else {
      cp='<input class="form-control" type="text" placeholder="Address" aria-label="default input fullname" id="counterpart" value="'+docdata.account+'" disabled >';  
    }
    document.getElementById("docsigncounterpart").innerHTML = cp;
    document.getElementById("docsignmsg").innerHTML ="";
    // show the signing modal
    signDocumentModal.show();
  }
}
// we update the UI fro drafts tab in case of dismiss button
document.getElementById("docsigndismiss").onclick = async () => {
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
          if(answerJSON.answer=='KO'){
            await show_error(answerJSON.message);
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
    if(answerJSON.answer=='KO'){
      await show_error(answerJSON.message);
      return;
    }
    actionsModal.hide();
    url=window.location.protocol + "//" + window.location.host+"/sign/?signaturetoken="+answerJSON.signaturetoken;
    //render_main('waiting');
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
          if(answerJSON.answer=='KO'){
            await show_error(answerJSON.message);
            return;
          }
          signDocumentModal.hide();
          render_main('rejected');
      }
  }
}
// actions on documents
// document view
document.getElementById("docsignview").onclick = async () => {
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    //check for blob available on chain
    const blob = await api.query.docSig.blobs(currentAccount.address,currentDocumentId,1);
    if(blob.length>0){
      let docUrl= await download_blob(blob);
      // download the file
      window.open(docUrl);
      return;
    }else {
      //download from server when it's not on chain (drafts)
      const params={
        account: currentAccount.address,
        token: currentToken,
        documentid: currentDocumentId
      }
      let url = window.location.protocol + "//" + window.location.host+"/docview";
      url=url+`?${qs.stringify(params)}`;
      window.open(url);
    }
  }
};
// actions on documents
// document sign
document.getElementById("docsignsign").onclick = async () => {
  await _sodium.ready;
  const sodium = _sodium;
  if(currentDocumentId>0){
    let docdata=get_document_data(currentDocumentId);
    // info message
    let msg='<div class="alert alert-info" role="alert"><center>';
    msg=msg+"Connecting...";
    msg=msg+"</center></div>";
    document.getElementById("docsignmsg").innerHTML = msg;
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
    //const injector = await web3FromSource(currentAccount.meta.source);
    console.log("currentAccount.address",currentAccount.address);
    let injector;
    try{
      injector = await web3FromAddress(currentAccount.address);
    }catch(e){
      console.log(e);
      console.log("injector",injector);
      const allInjected = await web3Enable('docsig.aisland.io');
      console.log("allInjected",allInjected);
      const allAccounts = await web3Accounts();
      console.log("allAccounts",allAccounts);
      injector = await web3FromAddress(currentAccount.address);
    }
    console.log("injector",injector);
    if(currentAccount.address==docdata.account){
        //check for document already signed
        const hash = await api.query.docSig.documents(docdata.account,currentDocumentId);
        const hashstring=`${hash}`
        if(hashstring!=='0x'){
            msg='<div class="alert alert-danger" role="alert"><center>';
            msg=msg+"Document already signed";
            msg=msg+"</center></div>";
            document.getElementById("docsignmsg").innerHTML = msg;
            return;
        }
    }else {
        //check for document already signed
        const hash = await api.query.docSig.signatures(currentAccount.address,currentDocumentId);
        const hashstring=`${hash}`
        if(hashstring!=='0x'){
            msg='<div class="alert alert-danger" role="alert"><center>';
            msg=msg+"Document already signed";
            msg=msg+"</center></div>";
            document.getElementById("docsignmsg").innerHTML = msg;
            console.log(msg);
            console.log("hashstring",hashstring);
            console.log("currentAccount.address",currentAccount.address);
            console.log("currentDocumentId",currentDocumentId);
            return;
        }
    }
    //check for counterpart address
    let counterpart='';
    let counterpartdb=''
    if(docdata.account==currentAccount.address){
      counterpart=document.getElementById("counterpart").value;
      counterpartdb=counterpart;
    }
    else {
      counterpart=docdata.account;
      counterpartdb=currentAccount.address;
    }
    // verify the validity of the counterpart address
    if(!isValidAddress(counterpart)){
      msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+"Counterpart address is not valid";
      msg=msg+"</center></div>";
      document.getElementById("docsignmsg").innerHTML = msg;
      console.log(msg);
      return;
    }
    // verify the counterpart is different from the current address
    if(counterpart==currentAccount.address){
      msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+"Counterpart address must be different from the document creator";
      msg=msg+"</center></div>";
      document.getElementById("docsignmsg").innerHTML = msg;
      console.log(msg);
      return;
    }
    // verify the counterpart has published the public key for encryption
    // the public key is published when the account configure the encryption password and sign the transaction for such purpose.
    let publickeyCounterpart = (await api.query.docSig.encryptionPublicKeys(counterpart)).toHuman();
    if(publickeyCounterpart.length==0){
      msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+"Counterpart has not yet published the public key, he/she should configure the encryption";
      msg=msg+"</center></div>";
      document.getElementById("docsignmsg").innerHTML = msg;
      console.log(msg);
      return;
    }
    publickeyCounterpart=hexToU8a(publickeyCounterpart);

    // get encryption private key (which is encrypted against a password)
    // the encrypted private key is stored on the server for data exchange between browsers
    // the password is used on the client side without visibility from the server
    let params ={
      account: currentAccount.address,
      token: currentToken,
    }
    let url = window.location.protocol + "//" + window.location.host+"/getprivatekey";
    const responsek = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
    let answerJSONk = await  responsek.json();
    let flagpk=true
    if (answerJSONk.answer=="KO" || typeof answerJSONk.encryptionkey==='undefined'){
      flagpk=false
      if(answerJSONk.message=="Token is not valid"){
        console.log(answerJSONk.message);
        await show_error(answerJSONk.message);
        return;
      }
    }
    if(flagpk){
      if(answerJSONk.encryptionkey.length==0)
        flagpk=false;
    }
    if(!flagpk){
      msg='<div class="alert alert-warning" role="alert"><center>';
      msg=msg+"Please configure the ENCRYPTION PASSWORD from \"Settings\"";
      msg=msg+"</center></div>";
      document.getElementById("docsignmsg").innerHTML = msg;
      console.log(msg);
      return;
    }
    // 
    encryptedprivatekey=base64ToUint8Array(answerJSONk.encryptionkey);
    const password=document.getElementById("password").value;
    // decrypt secret phrase using the supplied password
    let mnemonicPhrase=await decrypt_symmetric_stream(encryptedprivatekey,password);
    //convert array buffer to string
    mnemonicPhrase=arrayBufferToString(mnemonicPhrase);
    // check if the password worked
    if(mnemonicPhrase.length==0){
      msg='<div class="alert alert-warning" role="alert"><center>';
      msg=msg+"Encryption Password is wrong";
      msg=msg+"</center></div>";
      document.getElementById("docsignmsg").innerHTML = msg;
      console.log(msg);
      return;
    }
    // set the global var to reuse
    encryptionpwd=password;
    //update counterpart on the document table
    params ={
      account: currentAccount.address,
      token: currentToken,
      signaturetoken: signaturetoken,
      documentaccount: counterpartdb,
      documentid: currentDocumentId,
    }
    url = window.location.protocol + "//" + window.location.host+"/updatedocumentcounterpart";
    console.log("url",url);
    const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
    let answerJSON = await  response.json();
    console.log("answerJSON",answerJSON);
    if(answerJSON.answer=='KO'){
      await show_error(answerJSON.message);
      return;
    }
    //sign the document
    let signdocument;
    let blob;
    // check if the first signer or not
    if(currentAccount.address==docdata.account){
      // check for selected storage on blockchain
      if(document.getElementById("storageblockchain").checked){
        // get the document blob
        const params={
          account: currentAccount.address,
          token: currentToken,
          documentid: currentDocumentId
        };  
        let url = window.location.protocol + "//" + window.location.host+"/docdownload";
        url=url+`?${qs.stringify(params)}`;
        try {
          const response = await fetch(url);
          blob = await response.blob();
        } catch(e) {
          msg='<div class="alert alert-danger" role="alert"><center>';
          msg=msg+"Document cannot be read, something is wrong";
          msg=msg+"</center></div>";
          document.getElementById("docsignmsg").innerHTML = msg;
          console.log(msg);
          return;
        }
        //read blob file in arrayBuffer
        let ab =await blob.arrayBuffer();
        ab =new Uint8Array(ab);
        // generate the key pair
        const seedkeys = mnemonicToMiniSecret(mnemonicPhrase);
        const keyspair= sodium.crypto_box_seed_keypair(seedkeys);
        // encrypt the binary data
        const encryptedab=await encrypt_asymmetric_stream(ab,keyspair.privateKey,keyspair.publicKey,[publickeyCounterpart,keyspair.publicKey]);
        const blobb64=arrayBufferToBase64(encryptedab);
        // use utility pallet to store the document and sign the hash in one call
        const txs = [
          api.tx.docSig.newDocument(currentDocumentId,'0x'+docdata.hash),
          api.tx.docSig.newBlob(currentDocumentId, 1,blobb64)
        ];
        signdocument=api.tx.utility.batch(txs);
      }else {
        // proceed with the signature with the straight call to sign the hash
        signdocument=api.tx.docSig.newDocument(currentDocumentId,'0x'+docdata.hash);
      }
    }else{
      signdocument=api.tx.docSig.signDocument(currentDocumentId,'0x'+docdata.hash);
    }
    //const transferExtrinsic = api.tx.balances.transfer('5C5555yEXUcmEJ5kkcCMvdZjUo7NGJiQJMS7vZXEeoMhj3VQ', 123456);
    signdocument.signAndSend(currentAccount.address, { signer: injector.signer }, ({ status })   => {
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
          if(status.type=='Finalized'){
              signDocumentModal.hide();
              // update the status of the document
              let url = window.location.protocol + "//" + window.location.host+"/updatedocumentstatus";
              const params={
                account: currentAccount.address,
                token: currentToken,
              };
              fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
              // render main drafts
              render_main('drafts');
              
          }
      }
    }).catch((error) => {
      msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+` Tx failed: ${error}`;
      msg=msg+"</center></div>";
      document.getElementById("docsignmsg").innerHTML = msg;
    });

  }
};
// **** block of functions called from the call to actions (CATS) (not a group of feline friends :))
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
    if(answerJSON.answer=='KO'){
      await show_error(answerJSON.message);
      return;
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
    //fetch the injected wallet
    let allInjected = await web3Enable('docusign.aisland.io')
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
    if(allAccounts.length==0){
      //invite the user to create an account
      let msg='<div class="alert alert-warning" role="alert"><center>';
      msg=msg+'There are no accounts in your wallet. Please create one and click the button again when done';
      msg=msg+"</center></div>";
      document.getElementById("msg").innerHTML = msg;
      return;
    }
    // replace the text of the connect button with the account shortened 
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
    // finds an injector for an address
    //const injector = await web3FromSource(currentAccount.meta.source);
    const injector = await web3FromAddress(currentAccount.address);
    const signRaw = injector?.signer?.signRaw;
    if (!!signRaw) {
      // after making sure that signRaw is defined
      // we can use it to sign our message
      const { signature } = await signRaw({
          address: currentAccount.address,
          data: token,
          type: 'bytes'
      });
      // submit the signature/account/token to the server
      const params ={
        account: currentAccount.address,
        data: token,
        signature: signature
      }
      //console.log("params",params);
      let url = window.location.protocol + "//" + window.location.host+"/signin";
      const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
      let signinJSON = await  response.json();
      //check for approval 
      if(signinJSON.answer=='KO'){
        await show_error(answerJSON.message);
        return
      }
      //render the document list UI
      currentToken=token;
      // set a session variable
      publicsignaturetoken=signinJSON.publicsignaturetoken;
      window.sessionStorage.setItem("currentToken",currentToken);
      window.sessionStorage.setItem("currentAccount",JSON.stringify(currentAccount));
      window.sessionStorage.setItem("publicsignaturetoken",publicsignaturetoken);
      render_main('drafts');

  }
}
// function to render the main user interface after sign-in
async function render_main(section){
  // read signature token
  signaturetoken=getCookie('signaturetoken');
  // force the waiting document at the first time
  let signaturetokenfirstview=getCookie('signaturetokenfirstview');
  if(signaturetokenfirstview==signaturetoken && signaturetoken.length>0){
    section='drafts';
    //clear the cookie used for the first view
    document.cookie = "signaturetokenfirstview=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }
  // title
  let c='<div class="row">';
  c=c+'<div class="col-8 pb-1" style="background-color:#D2E3FF" ><center><h2>Blockchain Documents Signing</h2></center></div>';
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
//functions to render the different status from the links/buttons
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
  formData.append('files', file);
  formData.append('account', currentAccount.address);
  formData.append('token', currentToken);
  fetch(url, {
    method: 'POST',
    body: formData,
  })
  .then(async (answer) => { 
    let answerJSON = await  answer.json();
    //check answer
    if(answerJSON.answer=="KO" && answerJSON.message=='Token is not valid'){
      logout();
      return
    }
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
//function to return home with a logout
function logout(){
  window.sessionStorage.removeItem("currentToken");
  window.sessionStorage.removeItem("currentAccount");
  window.sessionStorage.removeItem("publicsignaturetoken");
  window.sessionStorage.clear();
  const home=window.location.protocol + "//" + window.location.host;
  window.location.reload(home);
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
  
  document.getElementById("root").innerHTML =c;
  // set border around edtior
  document.getElementById("editorjs").style.border = "solid #434545";
  // build path for standard signature and placeholder
  const standardsignature = window.location.protocol + "//" + window.location.host+"/publicsignature?t="+publicsignaturetoken;
  const counterpartsignature=window.location.protocol + "//" + window.location.host+"/img/signatureplaceholder.png";
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
      //signature plugin
      signature: {
        class: Signature,
        config: {
            standardsignature: standardsignature,
            counterpartsignature: counterpartsignature
        }
      }
    },
    
  });
  docsave.addEventListener('click',documentsave);
  docsave.param=editor;
  doccancel.addEventListener('click',documentcancel);
  doccancel.param=editor;
}
//function to save document
async function documentsave(evt) {
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
  let url = window.location.protocol + "//" + window.location.host+"/upload";
  let formData = new FormData();
  const content = data;
  const blob = new Blob([content], { type: "text/json" });
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
    //check answer
    if(answerJSON.answer=="KO" && answerJSON.message=='Token is not valid'){
      logout();
      return
    }
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
    eval(v);
  }
}
// function to clone/edit the template
async function templateClone(){
  // read select id from
  let id=document.getElementById("templateslist").value;
  // fetch docdata of the template
  const params={
    account: currentAccount.address,
    token: currentToken,
    documentid: id,
  }
  const url = window.location.protocol + "//" + window.location.host+"/templatedata";
  let response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
  let data = await  response.json();
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
  let html = await  response.text();
  document.getElementById("templateview").innerHTML =html;
  document.getElementById("templateview").style.border = "solid #434545";
}
// function to render the settings/edit signature which is the default tab active
async function render_settings(){
  // title
  let c='<div class="row">';
  c=c+'<div class="col-12 pb-1" style="background-color:#D2E3FF" ><center><h2>DocSig - Settings</h2></center></div>';
  c=c+'<div id="msg"></div>';
  // tabs signature/encryption
  c=c+'<div class="row"><div class="col">';
  c=c+'<ul class="nav nav-pills nav-fill">';
  c=c+'<li class="nav-item">';
  c=c+'<a class="nav-link active" id="standardSignature"  href="#"><i class="bi bi-vector-pen"></i> Signature</a>';
  c=c+'</li>';
  c=c+'<li class="nav-item">';
  c=c+'<a class="nav-link" id="Encryption" href="#"><i class="bi bi-file-earmark-lock2"></i> Encryption</a>';
  c=c+'</li>';
  c=c+'</ul>';
  c=c+'</div></div>';
  c=c+'<div class="row"><div class="col-1"></div><div class="col-9">';
  c=c+'<h5 style="text-align: center">Edit Your Signature</h5>';
  c=c+'<hr>';
  c=c+'</div></div>';
  //input fields
  c=c+'<div class="row"><div class="col-1"></div>';
  c=c+'<div class="col-5">';
  c=c+'<label for="fullname" class="form-label">Full Name</label>'
  c=c+'<input class="form-control" type="text" placeholder="" aria-label="default input fullname" id="fullname" required >';
  c=c+'</div>';
  c=c+'<div class="col-1">';
  c=c+'<label for="initials" class="form-label">Initials</label>'
  c=c+'<input class="form-control" type="text" placeholder="" aria-label="default input initials" id="initials" required>';
  c=c+'</div></div>';
  c=c+'<div class="row"><div class="col-1"></div>'
  c=c+'<div class="col-6">';
  // buttons
  c=c+'<br><button type="button" class="btn btn-primary" id="saveButton">Save</button>';
  c=c+' <button type="button" class="btn btn-secondary" id="cancelButton">Cancel</button>';
  c=c+'</div></div>';
  c=c+'<div class="row"><div class="col-1"></div><div class="col-9"><hr></div></div>';
  // fetch the fonts available with the one selected if any
  const params={
    token: currentToken,
    account: currentAccount.address,
  }
  // fetch data
  let url = window.location.protocol + "//" + window.location.host+"/signaturefonts";
  const response = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
  const fontsJSON = await  response.json();
  fonts=fontsJSON.fonts;
  //header
  c=c+'<div class="row"><div class="col-1"></div>';
  c=c+'<div class="col-1">Choose';
  c=c+'</div>';
  c=c+'<div class="col-6">';
  c=c+'Signature';
  c=c+'</div>';
  c=c+'<div class="col-2">';
  c=c+'Initials';
  c=c+'</div></div>';
  // file uploads
  c=c+'<div class="row">'
  c=c+'<div class="col-1"></div>';
  c=c+'<div class="col-1 bg-light">';
  c=c+'<div class="form-check ">'
  c=c+'<input class="form-check-input" type="radio" name="signatureradio" id="signatureopt" value="fileupload">';
  c=c+'</div>';
  c=c+'</div>';
  c=c+'<div class="col-6 bg-light">';
  c=c+'<input class="form-control" type="file" accept="image/*" id="signaturefile">';
  let paramss={
    account: currentAccount.address,
    token: currentToken,
    type: 'S'
  }
  let urls = window.location.protocol + "//" + window.location.host+"/getsignaturescanned"+`?${qs.stringify(paramss)}`;
  c=c+'<img src="'+urls+'" id="previewSignature" style="max-height:100px;max-width:300px;height:auto;">'
  c=c+'</div>';
  c=c+'<div class="col-2 bg-light">';
  c=c+'<input class="form-control" type="file" accept="image/*" id="initialsfile">';
  paramss.type='I'
  urls = window.location.protocol + "//" + window.location.host+"/getsignaturescanned"+`?${qs.stringify(paramss)}`;
  c=c+'<img src="'+urls+'" id="previewInitials" style="max-height:100px;max-width:200px;height:auto;">'
  c=c+'</div></div>';
  let background='bg-white';
  for(let i=0;i<fonts.length;i++) {
    if(fonts[i].length==0)
      continue;
    c=c+'<div class="row">'
    c=c+'<div class="col-1"></div>';
    c=c+'<div class="col-1 '+background+' text-dark">';
    c=c+'<div class="form-check ">'
    c=c+'<input class="form-check-input" type="radio" name="signatureradio" id="signatureopt'+i+'" value="'+i+'">';
    c=c+'</div>';
    c=c+'</div>';
    c=c+'<div class="col-6 '+background+' text-dark">';
    c=c+'<div id="signature'+i+'"></div>';
    c=c+'</div>';
    c=c+'<div class="col-2 '+background+' text-dark">';
    c=c+'<div id="initials'+i+'"></div>';
    c=c+'</div></div>';
    nrFonts=nrFonts+1;
    if(background=='bg-light')
      background='bg-white';
    else
      background='bg-light';
  }
  c=c+'<div class="row"><div class="col-1"></div><div class="col-9"><hr></div></div>';
  document.getElementById("root").innerHTML =c;
  // fetch current standard signature
  url = window.location.protocol + "//" + window.location.host+"/getsignature";
  url=url+`?${qs.stringify(params)}`;
  const responses = await fetch(url,{method: 'GET',},);
  let answerJSON = await  responses.json();
  if(typeof answerJSON.fullname=='undefined'){
    // set the full name and initials
    document.getElementById("fullname").value ="John Doe";
    document.getElementById("initials").value ="JD";  
  }else {
    if(answerJSON.fullname=='')
      document.getElementById("fullname").value ="John Doe";
    else
      document.getElementById("fullname").value =answerJSON.fullname;
    if(answerJSON.initials=='')
      document.getElementById("initials").value ="JD";
    else
      document.getElementById("initials").value =answerJSON.initials;
    // set the fontname
    document.getElementById("signatureopt").checked=true;
    if(answerJSON.fontname!=''){
      for(let i=0;i<fonts.length;i++){
        if(fonts[i]==answerJSON.fontname){
          document.getElementById("signatureopt"+i).checked=true;
        }
      }
    } 
  }
  // make first rendering of the signatures
  render_signatures();
  // set the refresh of the signatures at every typing inside the fullname/initials
  const fullname=document.getElementById("fullname");  
  fullname.addEventListener('input', render_signatures, false);   
  const initials=document.getElementById("initials");  
  initials.addEventListener('input', render_signatures, false);   
  // connect events for the buttons save//cancel
  const save=document.getElementById("saveButton");  
  save.addEventListener('click', save_signature, false);    
  const cancel=document.getElementById("cancelButton");  
  cancel.addEventListener('click', render_drafts, false); 
  // connect event for images upload
  const signaturefile=document.getElementById("signaturefile");  
  signaturefile.addEventListener('change', preview_signature, false);   
  const initialsfile=document.getElementById("initialsfile");  
  initialsfile.addEventListener('change', preview_initials, false);   
  const encryption=document.getElementById("Encryption");
  encryption.addEventListener('click', render_encryption, false);   

  
  // return false to avoid that click on href are executed
  return(false); // to avoid that click on href are executed
}
// function to render the encryption tab
async function render_encryption(){
  // title
  let c='<div class="row">';
  c=c+'<div class="col-12 pb-1" style="background-color:#D2E3FF" ><center><h2>DocSig - Settings</h2></center></div>';
  c=c+'<div id="msg"></div>';
  // tabs signature/encryption
  c=c+'<div class="row"><div class="col">';
  c=c+'<ul class="nav nav-pills nav-fill">';
  c=c+'<li class="nav-item">';
  c=c+'<a class="nav-link" id="standardSignature"  href="#"><i class="bi bi-vector-pen"></i> Signature</a>';
  c=c+'</li>';
  c=c+'<li class="nav-item">';
  c=c+'<a class="nav-link active" id="Encryption" href="#"><i class="bi bi-file-earmark-lock2"></i> Encryption</a>';
  c=c+'</li>';
  c=c+'</ul>';
  c=c+'</div></div>';
  c=c+'<div class="row"><div class="col-1"></div><div class="col-9">';
  c=c+'<h5 style="text-align: center">Configure Encryption</h5>';
  c=c+'<hr>';
  c=c+'</div></div>';
  // get private key of available
  const params={
    account: currentAccount.address,
    token: currentToken,
  }
  let url = window.location.protocol + "//" + window.location.host+"/getprivatekey";
  url=url+`?${qs.stringify(params)}`;
  const response = await fetch(url,{method: 'GET',},);
  let aj = await  response.json();
  if(aj.answer=="KO" || aj.encryptionkey==''){
      if(aj.message=="Token is not valid"){
        await show_error(aj.message);
        return
      }
      // generate mnemonic seed
      const mnemonic = mnemonicGenerate();
      // show a card element
      c=c+'<div class="row"><div class="col-1"></div><div class="col-9">';
      c=c+'<div class="card">';
      c=c+'<div class="card-body">';
      c=c+'<h5 class="card-title">Encryption Keys</h5>';
      c=c+'<p class="card-text">To encrypt end-to-end the documents, we have to use a keys pair (elliplict curve Ed22519). A random mnemonic phrase has been generated in your browser session. Your private key is derived from the mnemonic phrase.</p>';
      c=c+'<p class="card-text">You can use the mnemonic phrase to recover the encryption password in case of lost.</p>';
      c=c+'<p class="card-text">Please store it safely on paper or other non-electronic medium.</p>';
      c=c+'<p class="card-text"><div class="alert alert-warning" role="alert">We cannot recover your documents if you loose the password and the mnemonic phrase.</div></p>';
      c=c+'<label for="mnemonicPhrase" class="form-label">Mnemonic Phrase</label>'
      c=c+'<div class="input-group mb-3">';
      c=c+'<input class="form-control" type="text" placeholder="" aria-label="default input mnemonicPhrase" id="mnemonicPhrase" value="'+mnemonic+'" disabled>';
      c=c+'<span class="bi bi-clipboard" id="clipboard"></span>';
      c=c+'</div>';
      c=c+'<label for="password" class="form-label">Password</label>'
      c=c+'<input class="form-control" type="password" placeholder="" aria-label="default input password" id="password" required >';
      c=c+'<i id="strengthPassword" class="badge displayBadge">Weak</i>';
      c=c+'<p><small>Minimum 8 chars, upper and lower case letters,numbers and one symbol</small></p>'
      c=c+'<label for="repeatpassword" class="form-label">Repeat Password</label>'
      c=c+'<input class="form-control" type="password" placeholder="" aria-label="default input repeatpassword" id="repeatpassword" required >';
      c=c+'<i id="matchPassword" class="badge displayBadge">Not matching</i>';
      c=c+'</div></div>';
      // ask for password to encrypt the secret seed
      // buttons
      c=c+'<div class="row"><div class="col-1"></div><div class="col-9" id="msgbottom"></div></div>';  
      c=c+'<br><button type="button" class="btn btn-primary" id="saveButton">Save</button>';
      c=c+' <button type="button" class="btn btn-secondary" id="cancelButton">Cancel</button>';
      c=c+'</div></div>';
      c=c+'<div class="row"><div class="col-1"></div><div class="col-9"><hr></div></div>';  
      document.getElementById("root").innerHTML =c;
      // set the refresh of the signatures at every typing inside the fullname/initials
      const save=document.getElementById("saveButton");  
      save.addEventListener('click', save_encryption, false);    
      const cancel=document.getElementById("cancelButton");  
      cancel.addEventListener('click', render_drafts, false); 
      // tab button "Signature"
      const standardSignature=document.getElementById("standardSignature");
      standardSignature.addEventListener('click', render_settings, false);   
      // copy to clipboard the seed phrase
      const clipboard=document.getElementById("clipboard");
      clipboard.addEventListener('click', copy_mnemonic_phrase, false);  
      // password strength check
      const password=document.getElementById("password");
      password.addEventListener("input",strengthPassword,false);
      // password matching check
      const repeatpassword=document.getElementById("repeatpassword");
      repeatpassword.addEventListener("input",matchPassword,false);
  }else{
      encryptedprivatekey=base64ToUint8Array(aj.encryptionkey);
      c=c+'<div class="row"><div class="col-1"></div><div class="col-9">';
      c=c+'<div class="card">';
      c=c+'<div class="card-body">';
      c=c+'<h5 class="card-title">Change Password</h5>';
      c=c+'<p class="card-text">The encryption keys have been already created and safely stored. You can change their password:</p>';
      c=c+'<label for="oldpassword" class="form-label">Old Password</label>'
      c=c+'<input class="form-control" type="password" placeholder="" aria-label="default input oldpassword" id="oldpassword" required >';
      c=c+'<label for="password" class="form-label">New Password</label>'
      c=c+'<input class="form-control" type="password" placeholder="" aria-label="default input password" id="password" required >';
      c=c+'<i id="strengthPassword" class="badge displayBadge">Weak</i>';
      c=c+'<p><small>Minimum 8 chars, upper and lower case letters,numbers and one symbol</small></p>'
      c=c+'<label for="repeatpassword" class="form-label">Repeat Password</label>'
      c=c+'<input class="form-control" type="password" placeholder="" aria-label="default input repeatpassword" id="repeatpassword" required >';
      c=c+'<i id="matchPassword" class="badge displayBadge">Not matching</i>';
      c=c+'</div></div>';
      // ask for password to encrypt the secret seed
      // buttons
      c=c+'<br><button type="button" class="btn btn-primary" id="saveButton">Save</button>';
      c=c+' <button type="button" class="btn btn-secondary" id="cancelButton">Cancel</button>';
      c=c+'</div></div>';
      c=c+'<div class="row"><div class="col-1"></div><div class="col-9"><hr></div></div>';  
      document.getElementById("root").innerHTML =c;
      // set the refresh of the signatures at every typing inside the fullname/initials
      const save=document.getElementById("saveButton");  
      save.addEventListener('click', change_password_encryption, false);    
      const cancel=document.getElementById("cancelButton");  
      cancel.addEventListener('click', render_drafts, false); 
      // tab button "Signature"
      const standardSignature=document.getElementById("standardSignature");
      standardSignature.addEventListener('click', render_settings, false);   
      // password strength check
      const password=document.getElementById("password");
      password.addEventListener("input",strengthPassword,false);
      // password matching check
      const repeatpassword=document.getElementById("repeatpassword");
      repeatpassword.addEventListener("input",matchPassword,false);
  }
  // return false to avoid that click on href are executed
  return(false); // to avoid that click on href are executed
}
// function to encrypt and store at the server side the mnemonic seed
// the password is never sent to the server. The server acts as password manager.
async function save_encryption(){
  await _sodium.ready;
  const sodium = _sodium;
  // check password validity
  const password=document.getElementById("password");
  const repeatpassword=document.getElementById("repeatpassword");
  if(password.value!=repeatpassword.value){
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+"Password is not matching";
    msg=msg+"</center></div>";
    document.getElementById("msg").innerHTML = msg;
    return(false);
  }
  if(password.length<8){
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+"Password is too short, it must be at least 8 characters";
    msg=msg+"</center></div>";
    document.getElementById("msg").innerHTML = msg;
    return(false);
  }
  const mnemonicPhrase=document.getElementById("mnemonicPhrase").value;
  // encrypt the mnemonic phrase with the password
  const encdata=await encrypt_symmetric_stream(mnemonicPhrase,password.value);
  const encdatab64=uint8ArrayToBase64(encdata);
  // call the server to execute the storage
  const params={
    account: currentAccount.address,
    token: currentToken,
    privatekey: encdatab64
  }
  let url = window.location.protocol + "//" + window.location.host+"/saveprivatekey";
  url=url+`?${qs.stringify(params)}`;
  const response = await fetch(url,{method: 'GET',},);
  let answerJSON = await  response.json();
  // check the answer from the server
  if(answerJSON.answer=='KO'){
    await show_error(answerJSON.message);
    return(false);
  }
  //check if the public key is published
  // compute public key
  const seedString = mnemonicToMiniSecret(mnemonicPhrase);
  let keyspair=sodium.crypto_box_seed_keypair(seedString);
  // connect to the node
  // Retrieve the chain & node information information via rpc calls
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ]);
  const publickey = await api.query.docSig.encryptionPublicKeys(currentAccount.address);
  let msg='';
  if(keyspair.publicKey!=publickey){
    //store the public key on chain
    const publickeys=u8aToHex(keyspair.publicKey);
    //const injector = await web3FromSource(currentAccount.meta.source);
    const injector = await web3FromAddress(currentAccount.address);

    await api.tx.docSig.storePublickey(publickeys).signAndSend(currentAccount.address, { signer: injector.signer }, ({ status }) => {
      if (status.isInBlock) {
          msg='<div class="alert alert-info" role="alert"><center>';
          //msg=msg+`Tx Completed at block hash #${status.asInBlock.toString()}`;
          msg=msg+`Tx has been accepted, finalizing....`;
          msg=msg+"</center></div>";
          document.getElementById("msgbottom").innerHTML = msg;
      } else {
          msg='<div class="alert alert-info" role="alert"><center>';
          msg=msg+`Current Tx status: ${status.type}`;
          msg=msg+"</center></div>";
          document.getElementById("msgbottom").innerHTML = msg;
          if(status.type=='Finalized'){
            render_main('drafts');
            return;
          }
      }
    }).catch((error) => {
      msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+` Tx failed: ${error}`;
      msg=msg+"</center></div>";
      document.getElementById("msgbottom").innerHTML = msg;
    });
  }else{
    // return to main dashboard on drafts section
    render_main('drafts');
    return;
  }
}
//function to change password
async function change_password_encryption() {
  await _sodium.ready;
  const sodium = _sodium;
  //try to decrypt the private key
  const oldpassword=document.getElementById("oldpassword").value;
  if(oldpassword.lenght==0){
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+"Old Password is mandatory";
    msg=msg+"</center></div>";
    document.getElementById("msg").innerHTML = msg;
    return(false);
  }
  const mnemonicPhrase = await decrypt_symmetric_stream(encryptedprivatekey,oldpassword);
  if(mnemonicPhrase==false){
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+"Old Password is wrong";
    msg=msg+"</center></div>";
    document.getElementById("msg").innerHTML = msg;
    return(false);
  }
  // check password validity
  const password=document.getElementById("password");
  const repeatpassword=document.getElementById("repeatpassword");
  if(password.value!=repeatpassword.value){
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+"Password is not matching";
    msg=msg+"</center></div>";
    document.getElementById("msg").innerHTML = msg;
    return(false);
  }
  if(password.length<8){
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+"Password is too short, it must be at least 8 characters";
    msg=msg+"</center></div>";
    document.getElementById("msg").innerHTML = msg;
    return(false);
  }
  // save the private key with the new password
  // encrypt the mnemonic phrase with the password
  const encdata=await encrypt_symmetric_stream(mnemonicPhrase,password.value);
  const encdatab64=uint8ArrayToBase64(encdata);
  // call the server to execute the storage
  const params={
    account: currentAccount.address,
    token: currentToken,
    privatekey: encdatab64
  }
  let url = window.location.protocol + "//" + window.location.host+"/saveprivatekey";
  url=url+`?${qs.stringify(params)}`;
  const response = await fetch(url,{method: 'GET',},);
  let answerJSON = await  response.json();
  // check the answer from the server
  if(answerJSON.answer=='KO'){
    await show_error(answerJSON.message);
    return(false);
  }
  // show message on top and clean fields
  let msg='<div class="alert alert-success" role="alert"><center>';
  msg=msg+'Encryption password has been changed';
  msg=msg+"</center></div>";
  document.getElementById("msg").innerHTML = msg;
  document.getElementById("oldpassword").value='';
  document.getElementById("password").value='';
  document.getElementById("repeatpassword").value='';
  return(false);
}
//function to copy the mnemonic phrase to the clipboard
async function copy_mnemonic_phrase() {
  let mnemonicPhrase = document.getElementById("mnemonicPhrase").value;
  await navigator.clipboard.writeText(mnemonicPhrase);
  const clipboard=document.getElementById("clipboard");
  clipboard.className="bi bi-clipboard-check";
}
// function to check the strength of the password field and update a badge under the password field
async function strengthPassword(){
  let password = document.getElementById('password');
  let strengthPassword = document.getElementById('strengthPassword');
  // make the badge visible or invisible
  if(password.value.length !== 0){
    strengthPassword.style.display = 'block';
  } else {
    strengthPassword.style.display = 'none'
  }
  let strongPassword = new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})');
  let mediumPassword = new RegExp('((?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{6,}))|((?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9])(?=.{8,}))');
  if(strongPassword.test(password.value)) {
    strengthPassword.style.backgroundColor = "green"
    strengthPassword.textContent = 'Strong'
  } else if(mediumPassword.test(password.value)){
    strengthPassword.style.backgroundColor = 'blue'
    strengthPassword.textContent = 'Medium'
  } else{
    strengthPassword.style.backgroundColor = 'red'
    strengthPassword.textContent = 'Weak'
  }
}
// function to check the matching of repeat password field with the password
async function matchPassword(){
  let password = document.getElementById('password');
  let repeatpassword = document.getElementById('repeatpassword');
  let matchPassword = document.getElementById('matchPassword');
  // make the badge visible or invisible
  if(repeatpassword.value.length !== 0){
    matchPassword.style.display = 'block';
  } else {
    matchPassword.style.display = 'none'
  }
  if(password.value!=repeatpassword.value){
    matchPassword.style.backgroundColor = 'red'
    matchPassword.textContent = 'No matching'
  } else {
    matchPassword.style.backgroundColor = 'green'
    matchPassword.textContent = 'Matching'
  }
}
//function to filter the template by tag
// TODO - check since it's not used
function tagfilter(evt){
  console.log("tagfilter",evt.currentTarget.param);
  render_templates(evt.currentTarget.param);
  return;
}
//function to enable web3
async function enableWeb3() {
    //mesasge to invite the user to install the wallet
    let msg='<div class="alert alert-warning" role="alert"><center>';
    msg=msg+'There is no wallet extension in your browser. Please install the <a href="https://polkadot.js.org/extension/" target="_blank">Polkadot Wallet Extension</a>';
    msg=msg+' or <a href="https://www.subwallet.app" target="_blank">Subwallet</a>.';
    msg=msg+"</center></div>";

    try {
      await web3Enable('docusign.aisland.io');
      const allAccounts = await web3Accounts();
    }
    catch(e){
      document.getElementById("msg").innerHTML = msg;
      console.log(e);
      return;
    }
    //connect node 
    const provider = new WsProvider(BLOCKCHAINENDPOINT);
    api = await ApiPromise.create({ provider });
}

// render the signature with different type of fonts
// from global vars
async function render_signatures() {
  const fullnamev=document.getElementById("fullname").value;
  const initialsv=document.getElementById("initials").value;
  // generate the signatures with different fonts
  for(let i=0;i<fonts.length;i++) {
    if(fonts[i].length==0)
      continue;
    // we load the fonts one time only
    if(fontsFlag==false){
        const fontFile = new FontFace(
          "font"+i,
          "url("+fonts[i]+")",
        );
        document.fonts.add(fontFile);
        await fontFile.load();
    }
    let sgn=document.getElementById("signature"+i);
    let ini=document.getElementById("initials"+i);
    sgn.style.fontFamily = "font"+i;
    sgn.style.fontSize="24px";
    sgn.innerText = fullnamev;
    ini.style.fontFamily = "font"+i;
    ini.style.fontSize="24px";
    ini.innerText = initialsv;
  }
  // we set the flag to avoid reloading the fonts multiple times
  fontsFlag=true;
 }
 //function to save the standard signature
 async function save_signature() {
  const fullname=document.getElementById("fullname").value;
  const initials=document.getElementById("initials").value;
  const signatureradio=document.getElementsByName('signatureradio');
  let radio;
  for (radio of signatureradio){
    if (radio.checked) {
        break;
    }
  }
  let fontname='';
  if(radio.value=="fileupload"){
    fontname="SCANNED"
  }else{
    fontname=fonts[radio.value];
  }
  // call the server to execute the storage
  const params={
    account: currentAccount.address,
    token: currentToken,
    fullname: fullname,
    initials: initials,
    fontname: fontname
  }
  let url = window.location.protocol + "//" + window.location.host+"/updatesignature";
   url=url+`?${qs.stringify(params)}`;
  const response = await fetch(url,{method: 'GET',},);
  let answerJSON = await  response.json();
  // check the answer from the server
  if(answerJSON.answer=='KO'){
    await show_error(answerJSON.message);
    return(false);
  }
  // save scanned images if present
  await upload_image_signature();
  await upload_image_initials();
  //back to main UI
  render_drafts();
 }
//function to preview the signature image
async function preview_signature() {
  let signaturefile=document.getElementById("signaturefile");
  // check if the file is selected
  if(signaturefile.length==0)
    return;
  // check for file extension
  const fn=signaturefile.files[0].name;
  const extension=fn.slice(-4).toLowerCase();
  if(extension!=".png" && extension!=".jpg" && extension!=".jpeg"){
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+'Wrong file format, you can upload only .png or .jpg/.jpeg files';
    msg=msg+"</center></div>"; 
    document.getElementById("msg").innerHTML =msg;
    return;
  }
  //preview signature 
  let previewSignature=document.getElementById("previewSignature");
  if (signaturefile.files && signaturefile.files[0]) {
    var reader = new FileReader();
    reader.onload = function(e) {
      previewSignature.src = e.target.result;
      previewSignature.hidden=false;
    }
    reader.readAsDataURL(signaturefile.files[0]);
  }
 }
 //function to preview the signature image
async function preview_initials() {
  let initialsfile=document.getElementById("initialsfile");
  // check if the file is selected
  if(initialsfile.length==0)
    return;
  // check for file extension
  const fn=initialsfile.files[0].name;
  const extension=fn.slice(-4).toLowerCase();
  if(extension!=".png" && extension!=".jpg" && extension!=".jpeg"){
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+'Wrong file format, you can upload only .png or .jpg/.jpeg files';
    msg=msg+"</center></div>"; 
    document.getElementById("msg").innerHTML =msg;
    return;
  }
  //preview signature 
  let previewInitials=document.getElementById("previewInitials");
  if (initialsfile.files && initialsfile.files[0]) {
    var reader = new FileReader();
    reader.onload = function(e) {
      previewInitials.src = e.target.result;
      previewInitials.hidden=false;
    }
    reader.readAsDataURL(initialsfile.files[0]);
  }
 }
 //function to upload the signature image
async function upload_image_signature() {
  let signaturefile=document.getElementById("signaturefile");
  // check if the file is selected
  if(signaturefile.files.length==0)
    return;
  // check for file extension
  const fn=signaturefile.files[0].name;
  const extension=fn.slice(-4).toLowerCase();
  if(extension!=".png" && extension!=".jpg" && extension!=".jpeg"){
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+'Wrong file format, you can upload only .png or .jpg/.jpeg files';
    msg=msg+"</center></div>"; 
    document.getElementById("msg").innerHTML =msg;
    return;
  }
  // upload of the file
  let url = window.location.protocol + "//" + window.location.host+"/uploadsignature";
  let formData = new FormData();
  formData.append('account', currentAccount.address);
  formData.append('token', currentToken);
  formData.append('files', signaturefile.files[0]);
  fetch(url, {
    method: 'POST',
    body: formData,
  })
  .then(async (answer) => { 
    let answerJSON = await  answer.json();
    //check answer
    if(answerJSON.answer=="KO" && answerJSON.message=='Token is not valid'){
      logout();
      return
    }
    if(answerJSON.answer=="OK"){
      console.log("Upload has been completed",answerJSON);
      return;
    }else {
      console.log("Upload has NOT been completed",answerJSON);
      let msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+answerJSON.message;
      msg=msg+"</center></div>"; 
      document.getElementById("msg").innerHTML =msg;
      return;
    }
  })
  .catch((e) => { 
    console.log("error during the upload",e)
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+"Error during the upload, please retry later...."+e;
    msg=msg+"</center></div>";
    document.getElementById("msg").innerHTML = msg;
    return;
   });
  return;
 }
 //function to upload the initials image
 async function upload_image_initials() {
  let initialsfile=document.getElementById("initialsfile");
  // check if the file is selected
  if(initialsfile.files.length==0)
    return;
  // check for file extension
  const fn=initialsfile.files[0].name;
  const extension=fn.slice(-4).toLowerCase();
  if(extension!=".png" && extension!=".jpg" && extension!=".jpeg"){
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+'Wrong file format, you can upload only .png or .jpg/.jpeg files';
    msg=msg+"</center></div>"; 
    document.getElementById("msg").innerHTML =msg;
    return;
  }
  // upload of the file
  let url = window.location.protocol + "//" + window.location.host+"/uploadinitials";
  let formData = new FormData();
  formData.append('account', currentAccount.address);
  formData.append('token', currentToken);
  formData.append('files', initialsfile.files[0]);
  fetch(url, {
    method: 'POST',
    body: formData,
  })
  .then(async (answer) => { 
    let answerJSON = await  answer.json();
    //check answer
    if(answerJSON.answer=="KO" && answerJSON.message=='Token is not valid'){
      logout();
      return
    }
    if(answerJSON.answer=="OK"){
      console.log("Upload has been completed",answerJSON);
      return;
    }else {
      console.log("Upload has NOT been completed",answerJSON);
      let msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+answerJSON.message;
      msg=msg+"</center></div>"; 
      document.getElementById("msg").innerHTML =msg;
      return;
    }
  })
  .catch((e) => { 
    console.log("error during the upload",e)
    let msg='<div class="alert alert-danger" role="alert"><center>';
    msg=msg+"Error during the upload, please retry later...."+e;
    msg=msg+"</center></div>";
    document.getElementById("msg").innerHTML = msg;
    return;
   });
  return;
 }

// utility function to read cookie value
function getCookie(name){
  var pattern = RegExp(name + "=.[^;]*");
  var matched = document.cookie.match(pattern);
  if(matched){
      var cookie = matched[0].split('=');
      return cookie[1];
  }
    return '';
}

//function to validate substrate address
function isValidAddress(address){
  try {
      encodeAddress(
        isHex(address)
          ? hexToU8a(address)
          : decodeAddress(address)
      );
      return true;
    } catch (error) {
      return false;
  }
}
// function to show errors on div id=msg
async function show_error(message){
  let msg='<div class="alert alert-danger" role="alert"><center>';
      msg=msg+message;
      msg=msg+"</center></div>";
      document.getElementById("msg").innerHTML = msg;
      if(message=='Token is not valid'){
          alert("Authentication is expired, please make a new sign in");
          const home=window.location.protocol + "//" + window.location.host;
          window.sessionStorage.removeItem("currentToken");
          window.sessionStorage.removeItem("currentAccount");
          window.sessionStorage.removeItem("publicsignaturetoken");
          window.sessionStorage.clear();
          window.location.replace(home);
          return;
      }
}

// ATTENTION: this set of functions has been moved here from the modules since the crypto interface is not exposed in such case.

// function to encrypt a msg by public key and return an encrypted object
// the msg data type is Uint8Array, to support text or binary data
// it computes a shared key of 32 bytes between the sender and recipient (Diffie-Hellman)
// The shared key is used to encrypt a random key of 64 bytes.
// It makes a first encryption by chacha20 with the first 32 bytes of the random key.
// It makes a second encryption by AES-256-GCM witht the second 32 bytes of the random key
// the random nonces are generated internally
// the function returns an object with all the nonces used, the public keys involved and the encrypted msg
// the object can be serialised to store it on th blockchain
async function encrypt_asymmetric_stream(msg,senderprivatekey,senderpublickey,recipientpublickeys){
  await _sodium.ready;
  const sodium = _sodium;
  // generates random secret key 64 bytes (it will be used to encrypt the stream)
  const secretkey=sodium.randombytes_buf(64);
  // generate the encrypted key by x25519 to exchange the 64 bytes random secret
  const x=recipientpublickeys.length;
  let encsecretkeys=[];
  let nonces=[];
  for(let i=0;i<x;i++){
    // generates random nonce
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    // encrypts by x25519
    const encsecretkey=sodium.crypto_box_easy(secretkey,nonce,recipientpublickeys[i],senderprivatekey);
    //add to the array
    encsecretkeys.push(encsecretkey);
    nonces.push(nonce);
  }
  // use the first 32 bytes of the secret key to encrypt the msg by chacha algorithm
  const secretkeychacha=secretkey.slice(0,32);
  // generate a nonce for chacha20 (24 bytes)
  const noncechacha = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const encmsgchacha=sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(msg,null,null,noncechacha,secretkeychacha);
  // encrypt by AES-256 gcm
  //generate nonce for aes
  const nonceaes=sodium.randombytes_buf(12);
  // get secret key for Aes
  const secretkeyaes=secretkey.slice(32);
  // set the algorithm
  const alg = { name: 'AES-GCM', iv: nonceaes };
  // import the key
  const tmpkeyaes = await window.crypto.subtle.importKey('raw', secretkeyaes, alg, false, ['encrypt']);
  // encrypt the output of chacha
  const encmsgaesb=  await window.crypto.subtle.encrypt(alg, tmpkeyaes, encmsgchacha);                   
  const encmsgaes=new Uint8Array(encmsgaesb);
  let result={
    senderpublickey: senderpublickey,
    encsecret25519: encsecretkeys,
    nonce25519: nonces,
    recipientpublickeys: recipientpublickeys,
    noncechacha: noncechacha,
    nonceaes: nonceaes,
    encmsg: encmsgaes
  };
  // return encrypted object serialized with msgpackr
  return(pack(result));
}
// function to decrypt a msg and return an Uin8array with the clear message (private/public keys belongs to the party wishing to decrypt)
async function decrypt_asymmetric_stream(encmsgb,privatekey,publickey){
    // deserialize the encrypted object
    const encmsg=unpack(encmsgb);
    // wait for sodium to be available
    await _sodium.ready;
    const sodium = _sodium;
    // select the data for the public key received from the array of public keys stored
    const x=encmsg.recipientpublickeys.length;
    let encsecret25519;
    let nonce25519;
    for(let i=0;i<x;i++){
      if(isUint8ArrayEqual(publickey,encmsg.recipientpublickeys[i])){
        encsecret25519=encmsg.encsecret25519[i];
        nonce25519=encmsg.nonce25519[i]
        break;
      }
    }
    if(typeof encsecret25519=== 'undefined' || typeof nonce25519 === 'undefined')
    {
        return(false);
    }
    // decrypt the secret key from the public key encryption
    let secretkey;
    try {
      secretkey=sodium.crypto_box_open_easy(encsecret25519,nonce25519,encmsg.senderpublickey,privatekey);
    } catch(e){
      //console.log(e);
      return(false);
    }
    let secretkeychacha=secretkey.slice(0,32);
    let secretkeyaes=secretkey.slice(32);
    // decrypt first layer by AES-GCM
    const alg = { name: 'AES-GCM', iv: encmsg.nonceaes };
    // import the key
    const tmpkeyaes = await window.crypto.subtle.importKey('raw', secretkeyaes, alg, false, ['decrypt']);
    //decryption  by AESGCM
    const encmsgchachab=  await window.crypto.subtle.decrypt(alg, tmpkeyaes, encmsg.encmsg); 
    const encmsgchacha = new Uint8Array(encmsgchachab);
    // decryption second layer by Chacha20
    let result=sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null,encmsgchacha,null,encmsg.noncechacha,secretkeychacha);
    return(result);
  }
// function to encrypt a msg by password using symmetric encryption
// the msg data type is Uint8Array, to support text or binary data
// it derive the encryption keys from the supplied password
// It makes a first encryption by chacha20 with the first 32 bytes of the random key.
// It makes a second encryption by AES-256-GCM witht the second 32 bytes of the random key
// the random nonces are generated internally
// the function returns an object with all the nonces used, involved and the encrypted msg
// the object can be serialised to store it on th blockchain
async function encrypt_symmetric_stream(msg,password){
  await _sodium.ready;
  const sodium = _sodium;
  // secure derivation of 2 keys of 32 bytes + salt 16 byte (salt is random so the result is different)
  const key1=await derive_key_from_password(password);
  const key2=await derive_key_from_password(password);
  // generate random nonce for AES AND CHACHA
  const nonceaes = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const noncechacha = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  // get derive secret key and random salt
  const secretkeychacha=key1[0];
  const saltchacha=key1[1];
  const secretkeyaes=key2[0];
  const saltaes=key2[1];
  //encrypt msg by chacha
  const encmsgchacha=sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(msg,null,null,noncechacha,secretkeychacha);
  // encrypt by AES-256 gcm
  // set the algorithm
  const alg = { name: 'AES-GCM', iv: nonceaes };
  // import the key
  const tmpkeyaes = await window.crypto.subtle.importKey('raw', secretkeyaes, alg, false, ['encrypt']);
  // encrypt the output of chacha
  const encmsgaesb=  await window.crypto.subtle.encrypt(alg, tmpkeyaes, encmsgchacha);                   
  const encmsgaes=new Uint8Array(encmsgaesb);
  let result={
    saltchacha:saltchacha,
    saltaes:saltaes,
    noncechacha: noncechacha,
    nonceaes: nonceaes,
    encmsg: encmsgaes
  };
  // return encrypted object serialized with msgpackr
  return(pack(result));
}
async function decrypt_symmetric_stream(encmsgb,password){
  // deserialize the encrypted object
  const encmsg=unpack(encmsgb);
  // wait for sodium available
  await _sodium.ready;
  const sodium = _sodium;
  // get keys salt
  const saltchacha=encmsg.saltchacha;
  const saltaes=encmsg.saltaes;
  const key1=await derive_key_from_password(password,saltchacha);
  const key2=await derive_key_from_password(password,saltaes);
  // get derived secret keys
  const secretkeychacha=key1[0];
  const secretkeyaes=key2[0];
  // decrypt first layer by AES-GCM
  const alg = { name: 'AES-GCM', iv: encmsg.nonceaes };
  // import the key
  let tmpkeyaes;
  try {
    tmpkeyaes = await window.crypto.subtle.importKey('raw', secretkeyaes, alg, false, ['decrypt']);
  } catch(e) {
    return(false);
  }
  //decryption  by AESGCM
  let encmsgchachab;
  try {
    encmsgchachab=  await window.crypto.subtle.decrypt(alg, tmpkeyaes, encmsg.encmsg); 
  } catch(e) {
    return(false);
  }
  const encmsgchacha = new Uint8Array(encmsgchachab);
  // decryption second layer by Chacha20
  let result;
  try {
    result=sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null,encmsgchacha,null,encmsg.noncechacha,secretkeychacha);
  } catch(e) {
    return(false);
  }
  return(result);
}

// function to derive a secure key from a password
// it returns a 32 bytes key
async function derive_key_from_password(password,salt){
  await _sodium.ready;
  const sodium = _sodium;
  let randomsalt=sodium.randombytes_buf(16);
  if(typeof salt!='undefined'){
    randomsalt=salt;
  }
  const key = _sodium.crypto_pwhash(
      _sodium.crypto_box_SEEDBYTES,
      password,
      randomsalt,
      _sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      _sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      _sodium.crypto_pwhash_ALG_DEFAULT,
  );
  return([key,randomsalt]);
}
// functions to compare 2 uint8array
function isUint8ArrayEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }

  return true;
}
//function to download and decrypt a blob from the blockchain
async function download_blob(blob){
    await _sodium.ready;
    const sodium = _sodium;
    //console.log("Blob found on chain:",blob);
    const blobb64=u8aToString(blob);
    const blobenc=base64ToUint8Array(blobb64);
    //if the encrypted key is not loaded already in the current session
    if(typeof encryptedprivatekey === 'undefined'){
      // get encryption private key (which is encrypted against a password)
      // the encrypted private key is stored on the server for data exchange between browsers
      // the password is used on the client side without visibility from the server
      let params ={
        account: currentAccount.address,
        token: currentToken,
      }
      let url = window.location.protocol + "//" + window.location.host+"/getprivatekey";
      const responsek = await fetch(url+`?${qs.stringify(params)}`,{method: 'GET',},);
      let answerJSONk = await  responsek.json();
      if (answerJSONk.answer=="KO" || typeof answerJSONk.encryptionkey==='undefined'){
        alert(answerJSONk.message);
        return;
      }
      encryptedprivatekey=base64ToUint8Array(answerJSONk.encryptionkey);
    }
    // request for password if not available
    if(encryptionpwd.length==0){
      encryptionpwd=prompt("Encryption password:");
    }
    // decrypt secret phrase using the supplied password
    let mnemonicPhrase=await decrypt_symmetric_stream(encryptedprivatekey,encryptionpwd);
    //convert array buffer to string
    mnemonicPhrase=arrayBufferToString(mnemonicPhrase);
    // check if the password worked
    if(mnemonicPhrase.length==0){
      alert("Encryption Password is wrong");
      encryptionpwd='';
      return;
    }
    // generate the key pair from the mnemonic phrase
    const seedkeys = mnemonicToMiniSecret(mnemonicPhrase);
    const keyspair= sodium.crypto_box_seed_keypair(seedkeys);
    //decrypt the encrypted blob
    let doc= await decrypt_asymmetric_stream(blobenc,keyspair.privateKey,keyspair.publicKey);
    if(doc==false){
      alert("Error decrypting the document, it may be saved with a different encryption key");
    }
    //console.log("doc",doc);
    // get mimetype
    let docdata=get_document_data(currentDocumentId);
    let docBlob=new Blob([doc],{ type: docdata.mimetype });
    // create oject url
    let docUrl=URL.createObjectURL(docBlob);
    return(docUrl);
}