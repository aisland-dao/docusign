
// Unit tests
const _sodium =require('libsodium-wrappers-sumo');
const {mnemonicGenerate,mnemonicToMiniSecret} = require('@polkadot/util-crypto');

const  {encrypt_asymmetric_stream,
        decrypt_asymmetric_stream,
        encrypt_symmetric_stream,
        decrypt_symmetric_stream
    }
    = require('./modules/cryptostream.js');
// conversion utilities
const {
    bytestohex,
    arrayBufferToBase64,
    base64ToArrayBuffer,
  }=require("./modules/utility.js");

test('asymmetric encryption/decryption', async () => {
    // wait sodium library is ready
    await _sodium.ready;
    const sodium = _sodium;
    // generate keys
    const mnemonicAlice = mnemonicGenerate();
    const mnemonicBob = mnemonicGenerate();
    const seedAlice = mnemonicToMiniSecret(mnemonicAlice);
    const seedBob = mnemonicToMiniSecret(mnemonicBob);
    // generates key with sodium from the seed
    let keyspairAlice=sodium.crypto_box_seed_keypair(seedAlice);
    let keyspairBob=sodium.crypto_box_seed_keypair(seedBob);
    let msg= new Uint8Array([32,32,32,33,34,35,36,65,66,67,68,69]);
    let encobj= await encrypt_asymmetric_stream(msg,keyspairAlice.privateKey,keyspairAlice.publicKey,[keyspairBob.publicKey,keyspairAlice.publicKey]);
    let decryptedmsg=await decrypt_asymmetric_stream(encobj,keyspairBob.privateKey,keyspairBob.publicKey);
    let decryptedmsga=await decrypt_asymmetric_stream(encobj,keyspairAlice.privateKey,keyspairAlice.publicKey);
    expect(decryptedmsg).toEqual(msg);
    expect(decryptedmsga).toEqual(msg);
});

test('symmetric encryption/decryption', async () => {
    const msg= new Uint8Array([32,32,32,33,34,35,36,65,66,67,68,69]);
    let r=await encrypt_symmetric_stream(msg,"password_test");
    let dmsg=await decrypt_symmetric_stream(r,"password_test")
    expect(dmsg).toEqual(msg);
});

test('symmetric encryption/decryption failed', async () => {
    const msg= new Uint8Array([32,32,32,33,34,35,36,65,66,67,68,69]);
    let r=await encrypt_symmetric_stream(msg,"password_test");
    let dmsg=await decrypt_symmetric_stream(r,"password_wrong")
    expect(dmsg).not.toBe(msg);
});
test('asymmetric encryption/decryption failed with wrong public key', async () => {
    // wait sodium library is ready
    await _sodium.ready;
    const sodium = _sodium;
    // generate keys
    const mnemonicAlice = mnemonicGenerate();
    const mnemonicBob = mnemonicGenerate();
    const seedAlice = mnemonicToMiniSecret(mnemonicAlice);
    const seedBob = mnemonicToMiniSecret(mnemonicBob);
    // generates key with sodium from the seed
    let keyspairAlice=sodium.crypto_box_seed_keypair(seedAlice);
    let keyspairBob=sodium.crypto_box_seed_keypair(seedBob);
    let msg= new Uint8Array([32,32,32,33,34,35,36,65,66,67,68,69]);
    let encobj= await encrypt_asymmetric_stream(msg,keyspairAlice.privateKey,keyspairAlice.publicKey,[keyspairBob.publicKey,keyspairAlice.publicKey]);
    // wrong public key
    let decryptedmsg=await decrypt_asymmetric_stream(encobj,keyspairAlice.privateKey,keyspairBob.publicKey);
    expect(decryptedmsg).not.toBe(msg); 
});
test('asymmetric encryption/decryption failed with wrong keys pair', async () => {
    // wait sodium library is ready
    await _sodium.ready;
    const sodium = _sodium;
    // generate keys
    const mnemonicAlice = mnemonicGenerate();
    const mnemonicBob = mnemonicGenerate();
    const mnemonicJoe = mnemonicGenerate();
    const seedAlice = mnemonicToMiniSecret(mnemonicAlice);
    const seedBob = mnemonicToMiniSecret(mnemonicBob);
    const seedJoe = mnemonicToMiniSecret(mnemonicBob);
    // generates key with sodium from the seed
    let keyspairAlice=sodium.crypto_box_seed_keypair(seedAlice);
    let keyspairBob=sodium.crypto_box_seed_keypair(seedBob);
    let keyspairJoe=sodium.crypto_box_seed_keypair(seedJoe);

    let msg= new Uint8Array([32,32,32,33,34,35,36,65,66,67,68,69]);
    let encobj= await encrypt_asymmetric_stream(msg,keyspairAlice.privateKey,keyspairAlice.publicKey,[keyspairBob.publicKey,keyspairAlice.publicKey]);
    // wrong key pairs
    let decryptedmsg=await decrypt_asymmetric_stream(encobj,keyspairJoe.privateKey,keyspairJoe.publicKey);
    expect(decryptedmsg).not.toBe(msg); 

});

test('bytestohex valid', async () => {
    let bytes=new Uint8Array(4);
    bytes[0]=1;
    bytes[1]=2;
    bytes[2]=3;
    bytes[3]=4;
    let hex=bytestohex(bytes);
    expect(hex).toEqual('01020304');
});


test('bytestohex failed', async () => {
    let bytes=new Uint8Array(4);
    bytes[0]=1;
    bytes[1]=2;
    bytes[2]=3;
    bytes[3]=4;
    let hex=bytestohex(bytes);
    expect(hex).not.toBe('01020305');
});

test('arrayBufferToBase64 valid', async () => {
    let buffer = new Uint8Array(16);
    for(let i=0;i<16;i++){
        buffer[i]=i;
    }
    let bufferb64=arrayBufferToBase64(buffer);
    expect(bufferb64).toEqual("AAECAwQFBgcICQoLDA0ODw==");

});
test('arrayBufferToBase64 failed', async () => {
    let buffer = new Uint8Array(16);
    for(let i=0;i<16;i++){
        buffer[i]=i;
    }
    let bufferb64=arrayBufferToBase64(buffer);
    expect(bufferb64).not.toBe("BAECAwQFBgcICQoLDA0ODw==");

});

test('base64ToArrayBuffer valid', async () => {
    let bufferc = new Uint8Array(16);
    for(let i=0;i<16;i++){
        bufferc[i]=i;
    }
    let bufferb64="AAECAwQFBgcICQoLDA0ODw=="
    let buffer=base64ToArrayBuffer(bufferb64);
    let bufferuint8=new Uint8Array(buffer);
    expect(bufferc).toEqual(bufferuint8);
});

test('base64ToArrayBuffer failed', async () => {
    let bufferc = new Uint8Array(16);
    for(let i=0;i<16;i++){
        bufferc[i]=i;
    }
    let bufferb64="BAECAwQFBgcICQoLDA0ODw=="
    let buffer=base64ToArrayBuffer(bufferb64);
    let bufferuint8=new Uint8Array(buffer);
    expect(bufferc).not.toBe(bufferuint8);
});

