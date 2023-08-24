// set of conversion utilities

// utility function to convert bytes to hex 
function bytestohex(bytes) {
    var hexstring='', h;
    for(var i=0; i<bytes.length; i++) {
        h=bytes[i].toString(16);
        if(h.length==1) { h='0'+h; }
        hexstring+=h;
    }   
    return hexstring;
}
// function to convert array buffer to base64 string
function arrayBufferToBase64(arrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
// function to convert base64 to array buffer
function base64ToArrayBuffer(base64String) {
  const binaryString = atob(base64String);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

// function to convert Uint8Array to base64
function uint8ArrayToBase64(uint8Array) {
  const binaryString = uint8Array.reduce((acc, value) => acc + String.fromCharCode(value), '');
  return btoa(binaryString);
}
// function to convert base64 to Uint8Array
function base64ToUint8Array(base64String) {
  const binaryString = atob(base64String);
  const uint8Array = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }
  return uint8Array;
}
// function to convert an array buffer to string
function arrayBufferToString(arrayBuffer) {
  const uint8Array = new Uint8Array(arrayBuffer);
  let string = '';
  for (let i = 0; i < uint8Array.length; i++) {
    string += String.fromCharCode(uint8Array[i]);
  }
  return string;
}
module.exports ={bytestohex,arrayBufferToBase64,base64ToArrayBuffer,uint8ArrayToBase64,base64ToUint8Array,arrayBufferToString}