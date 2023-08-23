

const _sodium =require('libsodium-wrappers-sumo');
const {mnemonicGenerate,mnemonicToMiniSecret} = require('@polkadot/util-crypto');
const  {encrypt_asymmetric_stream,decrypt_asymmetric_stream}= require('./cryptostream.js');

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