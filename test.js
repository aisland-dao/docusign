
// Unit tests
const _sodium =require('libsodium-wrappers-sumo');
const {mnemonicGenerate,mnemonicToMiniSecret} = require('@polkadot/util-crypto');
const { Keyring } =require('@polkadot/keyring');
const qs=require('qs');


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
test('Api - Signin', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        data: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
        signature: '0x3e62a05fe7726a4767358b3cd2adc38e476913e5007a59930c74fcd6d547df63e5f45472512a63c7c8c2849044a652e4fb28322c66ccef9b35948c02fda84186'
    }
    let url="http://localhost:3000/signin"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let signinJSON = await  response.json();
    expect(signinJSON.answer).toEqual("OK");
});
test('Api - Signin', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        data: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
        signature: '0x3e62a05fe7726a4767358b3cd2adc38e476913e5007a59930c74fcd6d547df63e5f45472512a63c7c8c2849044a652e4fb28322c66ccef9b35948c02fda84186'
    }
    let url="http://localhost:3000/signin"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let signinJSON = await  response.json();
    expect(signinJSON.answer).toEqual("OK");
});

test('Api - Fetch Documents - Draft', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
    }
    let url="http://localhost:3000/documentsdrafts"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});

test('Api - Fetch Documents - Waiting', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
    }
    let url="http://localhost:3000/documentswaiting"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});

test('Api - Fetch Documents - Action Required', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
    }
    let url="http://localhost:3000/documentsactionrequired"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});
test('Api - Fetch Documents - Approved', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
    }
    let url="http://localhost:3000/documentsapproved"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});

test('Api - Fetch Documents - Rejected', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
    }
    let url="http://localhost:3000/documentsrejected"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});

test('Api - Fetch Templates', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
    }
    let url="http://localhost:3000/templates"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});

test('Api - Fetch Templates Tags', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
    }
    let url="http://localhost:3000/templatestags"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});

test('Api - Fetch Signature Fonts', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
    }
    let url="http://localhost:3000/signaturefonts"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});


test('Api - Fetch Public Signature', async () => {
    const params={
        t: '99208c8fd7a8f0b81283aec1ba5293be769bbfc2c7818535ca66d217ff7022b0', 
    }
    let url="http://localhost:3000/publicsignature"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    const imageBlob = await response.blob();
    expect(typeof imageBlob).toEqual("object");
});


test('Api - Get Private Key - Not found', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
    }
    let url="http://localhost:3000/getprivatekey"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});


test('Api - Update Signature Font', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
        fullname: 'John Doe',
        initials: 'JD',
        fontname: 'fonts/kristi/Kristi.ttf'
    }
    let url="http://localhost:3000/updatesignature"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});

test('Api - Update Document Counterpart ', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
        documentaccount: '5C4qhY5c8eiNfzuFHfFrohERpTNBM286KiWB3YTwx6X9aDho',
        documentid: "95"
    }
    let url="http://localhost:3000/updatedocumentcounterpart"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});

test('Api - Update Document Description ', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
        documentid: '95',
        description: "draft 5"
    }
    let url="http://localhost:3000/updatedocumentdescription"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    let answerJSON = await  response.json();
    expect(answerJSON.answer).not.toBe("KO");
});

test('Api - Download document', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
        documentid: "95"
    }
    let url="http://localhost:3000/docdownload"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    const docBlob = await response.blob();
    expect(typeof docBlob).toEqual("object");
});
test('Api - Get Template Data', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
        documentid: "1"
    }
    let url="http://localhost:3000/templatedata"+`?${qs.stringify(params)}`
    const response = await fetch(url,{method: 'GET',},);
    const docBlob = await response.blob();
    expect(typeof docBlob).toEqual("object");
});
test('Api - Get Template Rendering', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
        documentid: "1"
    }
    let url="http://localhost:3000/templateview"+`?${qs.stringify(params)}`
    console.log(url);
    const response = await fetch(url,{method: 'GET',},);
    const docBlob = await response.text();
    console.log(docBlob);
    expect(typeof docBlob).toEqual("string");
});

test('Api - Get Document Rendering', async () => {
    const params={
        account: '5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B', 
        token: 'e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766', 
        documentid: "95"
    }
    let url="http://localhost:3000/docview"+`?${qs.stringify(params)}`
    console.log(url);
    const response = await fetch(url,{method: 'GET',},);
    const docBlob = await response.text();
    console.log(docBlob);
    expect(typeof docBlob).toEqual("string");
});
