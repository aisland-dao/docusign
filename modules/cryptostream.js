

const _sodium =require('libsodium-wrappers-sumo');
const {mnemonicGenerate,mnemonicToMiniSecret} = require('@polkadot/util-crypto');
const crypto = require('crypto').webcrypto;
const { unpack, pack } = require('msgpackr');



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
  const tmpkeyaes = await crypto.subtle.importKey('raw', secretkeyaes, alg, false, ['encrypt']);
  // encrypt the output of chacha
  const encmsgaesb=  await crypto.subtle.encrypt(alg, tmpkeyaes, encmsgchacha);                   
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
    //console.log("******* encmsg:");
    //console.log(encmsg);
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
        //console.log("Public key received has not been found in the encrypted msg")
        return(false);
    }
    // decrypt the secret key from the public key encryption
    let secretkey;
    try {
      secretkey=sodium.crypto_box_open_easy(encsecret25519,nonce25519,encmsg.senderpublickey,privatekey);
    } catch(e){
      console.log(e);
      return(false);
    }
    let secretkeychacha=secretkey.slice(0,32);
    let secretkeyaes=secretkey.slice(32);
    // decrypt first layer by AES-GCM
    const alg = { name: 'AES-GCM', iv: encmsg.nonceaes };
    // import the key
    const tmpkeyaes = await crypto.subtle.importKey('raw', secretkeyaes, alg, false, ['decrypt']);
    //decryption  by AESGCM
    const encmsgchachab=  await crypto.subtle.decrypt(alg, tmpkeyaes, encmsg.encmsg); 
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
  const tmpkeyaes = await crypto.subtle.importKey('raw', secretkeyaes, alg, false, ['encrypt']);
  // encrypt the output of chacha
  const encmsgaesb=  await crypto.subtle.encrypt(alg, tmpkeyaes, encmsgchacha);                   
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
    tmpkeyaes = await crypto.subtle.importKey('raw', secretkeyaes, alg, false, ['decrypt']);
  } catch(e) {
    return(false);
  }
  //decryption  by AESGCM
  let encmsgchachab;
  try {
    encmsgchachab=  await crypto.subtle.decrypt(alg, tmpkeyaes, encmsg.encmsg); 
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
module.exports = {encrypt_asymmetric_stream,decrypt_asymmetric_stream,encrypt_symmetric_stream,decrypt_symmetric_stream};


