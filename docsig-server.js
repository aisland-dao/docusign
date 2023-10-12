// docSig Server
const express = require("express");
const cookieParser = require("cookie-parser");
let fs = require("fs");
const path = require("path");
let crypto = require("node:crypto");
let mysql = require("mysql2/promise");
let utilcrypto = require("@polkadot/util-crypto");
let util = require("@polkadot/util");
const multer = require("multer");
const { ApiPromise, WsProvider } = require("@polkadot/api");
const upload = multer({ dest: "upload/" });
const edjsHTML = require("editorjs-html");
// html->png for signature generation from font
const nodeHtmlToImage = require("node-html-to-image");
const { encodeToDataUrl } = require("node-font2base64");
const QRCode = require('qrcode');

let api;
const provider = new WsProvider("wss://testnet.aisland.io");

//setuw web express
let app = express();
app.use(cookieParser());
const DB_HOST = process.env.DB_HOST;
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PWD = process.env.DB_PWD;
const WALLET = process.env.WALLET;
const FEES = process.env.FEES;
const BASEURL=process.env.BASEURL;

// set default to local host if not set
if (typeof DB_HOST === "undefined") {
  console.log(
    Date.now(),
    "[Error] the environment variable DB_HOST is not set."
  );
  process.exit(1);
}
// DB_NAME is mandatory
if (typeof DB_NAME === "undefined") {
  console.log(
    Date.now(),
    "[Error] the environment variable DB_NAME is not set."
  );
  process.exit(1);
}
// DB_USER is mandatory
if (typeof DB_USER === "undefined") {
  console.log(
    Date.now(),
    "[Error] the environment variable DB_USER is not set."
  );
  process.exit(1);
}
// DB_PWD is mandatory
if (typeof DB_PWD === "undefined") {
  console.log(
    Date.now(),
    "[Error] the environment variable DB_PWD is not set."
  );
  process.exit(1);
}
// BASEURL is mandatory
if (typeof BASEURL === "undefined") {
  console.log(
    Date.now(),
    "[Error] the environment variable BASEURL is not set."
  );
  process.exit(1);
}

console.log("DocSig Server - v.1.00");
console.log("Listening on port tcp/3000 ....");
mainloop();
// main body
async function mainloop() {
  // connect to the node
  api = await ApiPromise.create({ provider });
  // Retrieve the chain & node information information via rpc calls
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ]);
  console.log(
    "Connected to: " + chain + " - " + nodeName + " - " + nodeVersion
  );
  // main page is dex.html with a permannet redirect
  app.get("/", async function (req, res) {
    res.redirect(301, "index.html");
  });
  // main page is index.html with a permannet redirect
  app.get("/signin", async function (req, res) {
    const signature = req.query.signature;
    const token = req.query.data;
    const account = req.query.account;
    console.log("account ", account, "token ", token, "signature ", signature);
    // verify signature
    try {
      const { isValid } = utilcrypto.signatureVerify(token, signature, account);
      if (isValid == false) {
        console.log("ERROR: Invalid Signature");
        res.send(
          '{"answer":"KO","message":"The signature is not matching the account, please check your configuration."}'
        );
        return;
      }
    } catch (e) {
      console.log("ERROR: Invalid Signature:", e);
      res.send(
        '{"answer":"KO","message":"The signature is not matching the account, please check your configuration."}'
      );
      return;
    }
    // store in DB
    //connect database
    let connection = await opendb();
    // check for the same account in the table
    const [rows, fields] = await connection.execute(
      "select * from users where account=?",
      [account]
    );
    let signaturetoken = "";
    if (rows.length == 0) {
      const randomtoken = crypto.randomBytes(32).toString("hex");
      signaturetoken = randomtoken;
      await connection.execute(
        "insert into users set account=?,token=?,dttoken=now(),signaturetoken=?",
        [account, token, randomtoken]
      );
    } else {
      await connection.execute(
        "update users set token=?,dttoken=now() where account=?",
        [token, account]
      );
      signaturetoken = rows[0].signaturetoken;
    }
    // confirm the signin
    const answer =
      '{"answer":"OK","message":"signin completed","publicsignaturetoken":"' +
      signaturetoken +
      '"}';
    console.log("Signin confirmed:", answer);
    await connection.end();
    res.send(answer);
    return;
  });
  // function to return the documents in draft status
  app.get("/documentsdrafts", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    let signaturetoken = req.cookies.signaturetoken;
    if (typeof signaturetoken === "undefined") {
      signaturetoken = "xxxxxxxxxxxxxxxxxxxxxxxxxxxx"; //unused token
    }
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request documentsdrafts");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request documentsdrafts");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    //update status
    await update_status_documents_drafts(account, connection);
    // make query for draft documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from documents where (account=? and status='draft') or (signaturetoken=? and status='draft') or (counterpart=? and status='draft') order by dtlastupdate desc",
      [account, signaturetoken, account]
    );
    // send the back the records in json format
    await connection.end();
    res.send(JSON.stringify(rows));
    return;
  });
  // function to return the documents in waiting status
  app.get("/documentswaiting", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    let signaturetoken = req.cookies.signaturetoken;
    if (typeof signaturetoken === "undefined") {
      signaturetoken = "xxxxxxxxxxxxxxxxxxxxxxxxxxxx"; //unused token
    }
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request documentswaiting");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request documentswaiting");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    await update_status_documents_waiting(account, connection);

    console.log("account: ", account, "signaturetoken: ", signaturetoken);
    // make query for waiting documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from documents where (account=? and status='waiting') or (signaturetoken=? and status='waiting') or (counterpart=? and status='waiting') order by dtlastupdate desc",
      [account, signaturetoken, account]
    );
    console.log(JSON.stringify(rows));
    // send the back the records in json format
    await connection.end();
    res.send(JSON.stringify(rows));
    return;
  });
  // function to return the documents in action required status
  app.get("/documentsactionrequired", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request documentsactionrequired");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request documentsactionrequired");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query for draft documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from documents where account=? and status='action' order by dtlastupdate desc",
      [account]
    );
    // send the back the records in json format
    await connection.end();
    res.send(JSON.stringify(rows));
    return;
  });
  // function to return the documents in approved status
  app.get("/documentsapproved", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request documentsapproved");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request documentsapproved");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query for draft documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from documents where (account=? or counterpart=?) and status='approved' order by dtlastupdate desc",
      [account, account]
    );
    // send the back the records in json format
    await connection.end();
    res.send(JSON.stringify(rows));

    return;
  });
  // function to update the document status for the account
  app.get("/updatedocumentstatus", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request documentsdrafts");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request documentsdrafts");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    //update status
    await update_status_documents_drafts(account, connection);
    await update_status_documents_waiting(account, connection);
    await connection.end();
    res.send('{"answer":"OK","message":"status updated"}');
    return;
  });
  // function to set the signaturetoken in a cookie and redirect to index.html
  app.get("/sign", async function (req, res) {
    // parameters required
    const signaturetoken = req.query.signaturetoken;
    // set cookie with signaturetoken
    if (typeof signaturetoken !== "undefined") {
      res.cookie("signaturetoken", signaturetoken);
      res.cookie("signaturetokenfirstview", signaturetoken);
    }
    // redirect to main UI
    res.redirect(302, "/index.html");
  });
  // function to return the documents in approved status
  app.get("/documentsrejected", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    let signaturetoken = req.cookies.signaturetoken;
    if (typeof signaturetoken === "undefined") {
      signaturetoken = "xxxxxxxxxxxxxxxxxxxxxxxxxxx"; //unsed code
    }
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request documentsrejected");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request documentsrejected");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query for draft documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from documents where (account=? or counterpart=? or signaturetoken=?) and status='rejected' order by dtlastupdate desc",
      [account, account, signaturetoken]
    );
    // send the back the records in json format
    console.log("documentsrejected:", JSON.stringify(rows));
    await connection.end();
    res.send(JSON.stringify(rows));
    return;
  });
  // document view
  app.get("/docview", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const documentid = req.query.documentid;
    const pdf = req.query.pdf;
    const pt = req.query.pt; 	// public view token
    // check security token
    if (typeof token === "undefined" && typeof pt === 'undefined') {
      console.log("ERROR: Missing token in request docview");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined" && typeof pt === 'undefined') {
      console.log("ERROR: Missing account in request docview");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check documentid
    if (typeof documentid === "undefined") {
      console.log("ERROR: Missing documentid in request docview");
      const answer = '{"answer":"KO","message":"documentid is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    let rows;
    let fields;
    if(typeof pt === 'undefined'){
      // check validity of the security token for the requested account
      const isValidToken = await check_token_validity(token, account, connection);
      if (!isValidToken) {
        const answer = '{"answer":"KO","message":"Token is not valid"}';
        await connection.end();
        res.send(answer);
        return;
      }
      // make query for  document (sql injection is managed)
      [rows, fields] = await connection.execute(
        "select * from documents where (account=? or counterpart=?) and id=?",
        [account, account, documentid]
      );
    }else {
      // make query for documents (sql injection is managed)
      console.log("pt:",pt,"documentid",documentid);
      [rows, fields] = await connection.execute(
        "select * from documents where publicviewtoken=? and id=?",
        [pt, documentid]
      );
    }
    if (rows.length == 0) {
      const answer =
        '{"answer":"KO","message":"documentid not found"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // configure the sending
    let options = {
      root: path.join(__dirname, "upload"),
      dotfiles: "deny",
      headers: {
        "Content-Type": rows[0].mimetype,
        "Content-Disposition": "inline; filename=" + rows[0].originalfilename,
        "Content-Length": rows[0].size,
        "x-timestamp": Date.now(),
        "x-sent": true,
      },
    };
    // check .dcs files
    const originalfilename = rows[0].originalfilename;
    //console.log("originalfilename",originalfilename);
    if (originalfilename.slice(-4) == ".dcs") {
      // convert the file to html for rendering
      // Initialize the parser
      //console.log("special processing for .dcs");
      const edjsParser = edjsHTML({signature: signatureParser});
      const fileNameDcs = "upload/" + rows[0].urlfile;
      //console.log("fileNameDcs:",fileNameDcs);
      const contentFile = fs.readFileSync(fileNameDcs);
      const contentFileObj = JSON.parse(contentFile.toString());
      //console.log("contentFileObj",contentFileObj);
      let html='';
      if (typeof pdf !== 'undefined')
         html='<head><script src="js/html2pdf.bundle.min.js"></script></head><body>';
      html=html+'<div id="dcsdoc">';
      html = html+edjsParser.parse(contentFileObj);
      html=html+"</div>";
      // add qr code for public verification
      let qrurl=BASEURL+"/docverify?pt="+rows[0].publicviewtoken+"&documentid="+documentid;
      let qrimg='';
      try {
         qrimg= await QRCode.toDataURL(qrurl);
      }catch(e){
        console.log("Error in qrcode generation:",e);
      }
      if(qrimg.length>0){
        html=html+"<hr>You can verify the authenticity of the this document on blockchain, scanning the following qrcode:<br>";
        html=html+'<img src="'+qrimg+'">';
      }
      if (typeof pdf !== 'undefined') {
        html=html+'</body><script>';
        html=html+'html2pdf(document.getElementById("dcsdoc"));';
        html=html+'</script>';
      }
      console.log("html",html);
      let optionsDcs = {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": "inline; filename=" + rows[0].originalfilename,
          "Content-Length": rows[0].size,
          "x-timestamp": Date.now(),
          "x-sent": true,
        },
      };
      let c = "";
      let i = 0;
      const x = html.length;
      for (i = 0; i < x; i++) {
        c = c + html[i];
      }
      res.send(c, optionsDcs, function (err) {
        if (err) {
          console.log("ERROR:" + err);
        } else {
          console.log("INFO: File Sent:", fileName);
          return;
        }
      });
      return;
    }
    //send the any other type of file
    let fileName = rows[0].urlfile;
    res.sendFile(fileName, options, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log("File Sent:", fileName);
        return;
      }
    });
  });
  // public view of a document for verification (using a security token
  app.get("/docverify", async function (req, res) {
    // parameters required
    const documentid = req.query.documentid;
    const pt = req.query.pt; 	// public view token
    // check documentid
    if (typeof documentid === "undefined") {
      console.log("ERROR: Missing documentid in request docverify");
      const answer = '{"answer":"KO","message":"documentid is mandatory"}';
      res.send(answer);
      return;
    }
    if (typeof pt === "undefined") {
      console.log("ERROR: Missing public token in request docverify");
      const answer = '{"answer":"KO","message":"pt is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // make query for documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
        "select * from documents where publicviewtoken=? and id=?",
        [pt, documentid]
      );
    if (rows.length == 0) {
      const answer =
        '<h1>Document not found</h1>';
      await connection.end();
      res.send(answer);
      return;
    }
    // render the document verification view
    
    let c='<html><head><meta charset="utf-8">';
    c=c+'<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">';
    c=c+'<title>Aisland - DocSig</title>';
    c=c+'<script src="/js/bootstrap.bundle.min.js"></script>';
    c=c+'<link rel="stylesheet" href="/css/bootstrap.min.css">';
    c=c+'<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">';
    c=c+'</head><body>';
    c=c+'<div class="container-fluid">'
    //c=c+'<div class="row"><div class="col-2"></div>';
    c=c+'<div class="col"><div class="card" style="width: 33rem;">';
    c=c+'<center><img src="img/logo.png" height="100px" width="100px"></center>';
    c=c+'<div class="card-body">';
    c=c+'<h5 class="card-title">Document Verification</h5>';
    c=c+'<p class="card-text">This is the public verification of the following document:</p>';
    c=c+'<table class="table table-striped-columns">';
    c=c+`<tr><td><i class="bi bi-speedometer"></i> Status:</td><td>${rows[0].status}</td></tr>`;
    c=c+`<tr><td><i class="bi bi-tag"></i> Description:</td><td>${rows[0].description} </td></tr>`;
    let lastupdate=rows[0].dtlastupdate;
    c=c+'<tr><td><i class="bi bi-calendar2-event"></i> Last Update:</td><td>'+lastupdate+'</td></tr>';
    c=c+'</table>';
    c=c+'<center><h4>Signed by:</h4></center>';
    c=c+'<table class="table table-striped">';   
    c=c+'<tr><td>Account</td></tr>';
    c=c+`<tr><td>${rows[0].account}</td><td></td>`;
    c=c+`<td>${rows[0].counterpart}</td></tr>`
    c=c+'</table>';
    let dv='/docview?pt='+pt+'&documentid='+documentid;
    c=c+'<a href="'+dv+'" class="btn btn-primary">View</a>';
    c=c+'</div></div></div></div></div></body></html>';
    res.send(c);
    await connection.end();
  });
  // template view
  app.get("/templateview", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const documentid = req.query.documentid;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request docview");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request docview");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check documentid
    if (typeof documentid === "undefined") {
      console.log("ERROR: Missing documentid in request docview");
      const answer = '{"answer":"KO","message":"documentid is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query for templates (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from templates where id=?",
      [documentid]
    );
    if (rows.length == 0) {
      const answer = '{"answer":"KO","message":"documentid not found"}';
      await connection.end();
      res.send(answer);
      return;
    }
    await connection.end();
    const edjsParser = edjsHTML();
    const contentFileObj = JSON.parse(rows[0].content);
    const html = edjsParser.parse(contentFileObj);
    console.log("html", html);
    let options = {
      headers: {
        "Content-Type": "text/html",
        "x-timestamp": Date.now(),
        "x-sent": true,
      },
    };
    let c = "";
    let i = 0;
    const x = html.length;
    for (i = 0; i < x; i++) {
      c = c + html[i];
    }
    console.log("c", c);
    res.send(c, options, function (err) {
      if (err) {
        console.log("ERROR:" + err);
      } else {
        console.log("INFO: File Sent:", fileName);
        return;
      }
    });
    return;
  });
  // template data
  app.get("/templatedata", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const documentid = req.query.documentid;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request docview");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request docview");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check documentid
    if (typeof documentid === "undefined") {
      console.log("ERROR: Missing documentid in request docview");
      const answer = '{"answer":"KO","message":"documentid is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query for templates (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from templates where id=?",
      [documentid]
    );
    if (rows.length == 0) {
      const answer = '{"answer":"KO","message":"documentid not found"}';
      await connection.end();
      res.send(answer);
      return;
    }
    let options = {
      headers: {
        "Content-Type": "text/json",
        "x-timestamp": Date.now(),
        "x-sent": true,
      },
    };
    connection.close();
    res.send(rows[0].content, options, function (err) {
      if (err) {
        console.log("ERROR:" + err);
      } else {
        console.log("INFO: File Sent:", fileName);
        return;
      }
    });
    return;
  });
  // document delete
  app.get("/docdelete", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const documentid = req.query.documentid;
    console.log(account, documentid);
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request docdelete");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request docdelete");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check documentid
    if (typeof documentid === "undefined") {
      console.log("ERROR: Missing documentid in request docdelete");
      const answer = '{"answer":"KO","message":"documentid is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query for draft documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from documents where account=? and id=? and status='draft'",
      [account, documentid]
    );
    if (rows.length == 0) {
      const answer =
        '{"answer":"KO","message":"documentid in draft not found for the account"}';
      res.send(answer);
      return;
    }
    console.log("Document to delete:", rows[0]);
    const filename = "upload/" + rows[0].urlfile;
    //delete the file
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename);
    }
    // delete the record
    await connection.execute(
      "delete from documents where account=? and id=? and status='draft'",
      [account, documentid]
    );
    //return message to client
    const answer = '{"answer":"OK","message":"document deleted"}';
    await connection.end();
    res.send(answer);
    return;
  });
  // document reject
  app.get("/docreject", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const documentid = req.query.documentid;
    let signaturetoken = req.cookies.signaturetoken;
    if (typeof signaturetoken === "undefined") {
      signaturetoken = "xxxxxxxxxxxxxxxxxxx";
    }
    console.log(account, documentid);
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request docreject");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request docreject");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check documentid
    if (typeof documentid === "undefined") {
      console.log("ERROR: Missing documentid in request docreject");
      const answer = '{"answer":"KO","message":"documentid is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query for draft documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from documents where (account=? or counterpart=? or signaturetoken=?) and id=? and status='waiting'",
      [account, account, signaturetoken, documentid]
    );
    if (rows.length == 0) {
      const answer =
        '{"answer":"KO","message":"documentid in waiting not found for the account:' +
        account +
        " id: " +
        documentid +
        '"}';
      await connection.end();
      res.send(answer);
      return;
    }
    console.log("Document to reject:", rows[0]);

    // reject
    await connection.execute(
      "update documents set status='rejected' where (account=? or counterpart=? or signaturetoken=?) and id=? and status='waiting'",
      [account, account, signaturetoken, documentid]
    );
    //return message to client
    const answer = '{"answer":"OK","message":"document rejected"}';
    await connection.end();
    res.send(answer);
    return;
  });
  // document link
  app.get("/doclink", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const documentid = req.query.documentid;
    console.log(account, documentid);
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request docreject");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request docreject");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check documentid
    if (typeof documentid === "undefined") {
      console.log("ERROR: Missing documentid in request docreject");
      const answer = '{"answer":"KO","message":"documentid is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query for draft documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from documents where account=? and id=? and (status='draft' or status='waiting')",
      [account, documentid]
    );
    if (rows.length == 0) {
      const answer =
        '{"answer":"KO","message":"documentid not found for the account"}';
      res.send(answer);
      return;
    }
    console.log("Document to generate link:", rows[0]);
    let signaturetoken = "";
    if (rows[0].signaturetoken.length == 0) {
      signaturetoken = crypto.randomBytes(32).toString("hex");
      console.log("signaturetoken", signaturetoken);
      //await connection.execute("update documents set status='waiting',signaturetoken=? where account=? and id=? and status='draft'",[signaturetoken,account,documentid]);
      await connection.execute(
        "update documents set signaturetoken=? where account=? and id=?",
        [signaturetoken, account, documentid]
      );
    } else {
      signaturetoken = rows[0].signaturetoken;
      //await connection.execute("update documents set status='waiting' where account=? and id=? and status='draft'",[account,documentid]);
    }
    console.log("signaturetoken 2", signaturetoken);
    //return message to client
    const answer = '{"answer":"OK","signaturetoken":"' + signaturetoken + '"}';
    await connection.end();
    res.send(answer);
    return;
  });
  // function to return the templates
  app.get("/templates", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request documentsrejected");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request documentsrejected");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query to get templates
    const [rows, fields] = await connection.execute(
      "select * from templates order by description"
    );
    // send the back the records in json format
    console.log("templates:", JSON.stringify(rows));
    await connection.end();
    res.send(JSON.stringify(rows));
    return;
  });
  // function to return the templates tags
  app.get("/templatestags", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request documentsrejected");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request documentsrejected");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query to get templates
    const [rows, fields] = await connection.execute(
      "select tags from templates"
    );
    // send the back the records in json format
    const tags = getUniqueTags(rows);
    await connection.end();
    res.send(JSON.stringify(tags));
    return;
  });
  // function to update the document description
  app.get("/updatedocumentdescription", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const documentid = req.query.documentid;
    const description = req.query.description;

    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request updatedocumentdescription");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log(
        "ERROR: Missing account in request updatedocumentdescription"
      );
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check documentid
    if (typeof documentid === "undefined") {
      console.log(
        "ERROR: Missing documentid in request updatedocumentdescription"
      );
      const answer = '{"answer":"KO","message":"documentid is mandatory"}';
      res.send(answer);
      return;
    }
    // check description
    if (typeof description === "undefined") {
      console.log(
        "ERROR: Missing description in request updatedocumentdescription"
      );
      const answer = '{"answer":"KO","message":"description is mandatory"}';
      res.send(answer);
      return;
    }
    if (description.length == 0) {
      console.log(
        "ERROR: Missing description in request updatedocumentdescription"
      );
      const answer = '{"answer":"KO","message":"description is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query for draft documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "update documents set description=? where account=? and id=?",
      [description, account, documentid]
    );
    const answer = '{"answer":"OK","message":"description has been updated"}';
    await connection.end();
    res.send(answer);
    return;
  });
  // function to update the document description
  app.get("/updatedocumentcounterpart", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const signaturetoken = req.query.signaturetoken;
    const account = req.query.account;
    const documentid = req.query.documentid;
    const documentaccount = req.query.documentaccount;
    console.log("req.query", req.query);
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request updatedocumentcounterpart");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log(
        "ERROR: Missing account in request updatedocumentcounterpart"
      );
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check documentid
    if (typeof documentid === "undefined") {
      console.log(
        "ERROR: Missing documentid in request updatedocumentcounterpart"
      );
      const answer = '{"answer":"KO","message":"documentid is mandatory"}';
      res.send(answer);
      return;
    }
    // check documentaccount
    if (typeof documentaccount === "undefined") {
      console.log(
        "ERROR: Missing documentaccount in request updatedocumentcounterpart"
      );
      const answer = '{"answer":"KO","message":"documentaccount is mandatory"}';
      res.send(answer);
      return;
    }
    if (documentaccount.length == 0) {
      console.log(
        "ERROR: Missing documentaccount in request updatedocumentcounterpart"
      );
      const answer = '{"answer":"KO","message":"documentaccount is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    console.log("signaturetoken", signaturetoken);
    // update the counterpart field when coming from the creator of the document
    await connection.execute(
      "update documents set counterpart=? where account=? and id=?",
      [documentaccount, account, documentid]
    );
    // update the counterpart field when coming from the counterpart with valid signaturetoken
    if (typeof signaturetoken !== "undefined") {
      await connection.execute(
        "update documents set counterpart=? where signaturetoken=? and id=?",
        [documentaccount, signaturetoken, documentid]
      );
    }
    const answer = '{"answer":"OK","message":"counterpart has been updated"}';
    console.log("answer", answer);
    //console.log(answer,account,documentaccount,documentid)
    await connection.end();
    res.send(answer);
    return;
  });
  // document download
  app.get("/docdownload", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const documentid = req.query.documentid;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request docdownload");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request docdownload");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check documentid
    if (typeof documentid === "undefined") {
      console.log("ERROR: Missing documentid in request docdownload");
      const answer = '{"answer":"KO","message":"documentid is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // make query for draft documents (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from documents where (account=? or counterpart=?) and id=?",
      [account, account, documentid]
    );
    if (rows.length == 0) {
      const answer =
        '{"answer":"KO","message":"documentid not found for the account"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // configure the sending
    let options = {
      root: path.join(__dirname, "upload"),
      dotfiles: "deny",
      headers: {
        "Content-Type": rows[0].mimetype,
        "Content-Disposition":
          "attachment; filename=" + rows[0].originalfilename,
        "Content-Length": rows[0].size,
        "x-timestamp": Date.now(),
        "x-sent": true,
      },
    };
    //send the file
    let fileName = rows[0].urlfile;
    res.sendFile(fileName, options, async function (err) {
      if (err) {
        console.log(err);
        await connection.end();
      } else {
        console.log("File Sent:", fileName);
        await connection.end();
        return;
      }
    });
  });
  // function to return the fonts available for signature
  app.get("/signaturefonts", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request signaturefonts");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request signaturefonts");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    const fonts = await get_fonts_list();
    const fontsr = { selected: "", fonts: fonts };
    await connection.end();
    res.send(JSON.stringify(fontsr));
    return;
  });
  // function to store the standard signature
  app.get("/updatesignature", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const fullname = req.query.fullname;
    const initials = req.query.initials;
    const fontname = req.query.fontname;

    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request updatesignature");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request updatesignature");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check full name
    if (typeof fullname === "undefined") {
      console.log("ERROR: Missing fullname in request updatesignature");
      const answer = '{"answer":"KO","message":"fullname is mandatory"}';
      res.send(answer);
      return;
    }
    if (fullname.length == 0) {
      console.log("ERROR: Empty fullname in request updatesignature");
      const answer = '{"answer":"KO","message":"fullname is mandatory"}';
      res.send(answer);
      return;
    }
    // check initials
    if (typeof initials === "undefined") {
      console.log("ERROR: Missing initials in request updatesignature");
      const answer = '{"answer":"KO","message":"initials is mandatory"}';
      res.send(answer);
      return;
    }
    if (initials.length == 0) {
      console.log("ERROR: Empty initials in request updatesignature");
      const answer = '{"answer":"KO","message":"initials is mandatory"}';
      res.send(answer);
      return;
    }
    // check fontname
    if (typeof fontname === "undefined") {
      console.log("ERROR: Missing fontname in request updatesignature");
      const answer = '{"answer":"KO","message":"fontname is mandatory"}';
      res.send(answer);
      return;
    }
    if (fontname.length == 0) {
      console.log("ERROR: Empty fontname in request updatesignature");
      const answer = '{"answer":"KO","message":"fontname is mandatory"}';
      res.send(answer);
      return;
    }

    if (fontname != "SCANNED") {
      // check if fontname does exist on disk
      if (!fs.existsSync("html/" + fontname)) {
        console.log("ERROR: Wrong fontname in request updatesignature");
        const answer =
          '{"answer":"KO","message":"fontname has not been found"}';
        res.send(answer);
        return;
      }
    }
    // connect db
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // store on DB the standard signature
    await connection.execute(
      "update users set signaturefullname=?,signatureinitials=?,signaturefontname=? where account=? and token=?",
      [fullname, initials, fontname, account, token]
    );
    const answer =
      '{"answer":"OK","message":"Standard signature has been updated"}';
    await connection.end();
    res.send(answer);
    //close db
    return;
  });
  // function to fetch the standard signature based on font
  app.get("/getsignature", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request updatesignature");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request updatesignature");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // connect db
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // get the standard signature (possible empty data if was not set)
    const [rows, fields] = await connection.execute(
      "select signaturefullname as fullname,signatureinitials as initials,signaturefontname as fontname from users where account=? and token=?",
      [account, token]
    );
    if (rows.length == 0) {
      const answer = '{"answer":"KO","message":"user not found"}';
      await connection.end();
      res.send(answer);
      return;
    }
    // send back signature data
    await connection.end();
    res.send(JSON.stringify(rows[0]));

    return;
  });
  // scanned signatures download
  app.get("/getsignaturescanned", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const type = req.query.type;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request getsignaturescanned");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request getsignaturescanned");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check type
    if (typeof type === "undefined") {
      console.log("ERROR: Missing type in request getsignaturescanned");
      const answer =
        '{"answer":"KO","message":"type of the scanned signature (S/I) is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      console.log("answer:", answer);
      await connection.end();
      res.send(answer);
      console.log("returning back");
      return;
    }
    // make query (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from scannedsignatures where account=? and type=?",
      [account, type]
    );
    if (rows.length == 0) {
      const answer =
        '{"answer":"KO","message":"scanned signature not found for the account"}';
      console.log("answer:", answer);
      await connection.end();
      //res.send(answer);
      //send file with 1 white pixel
      // configure the sending
      let options = {
        root: path.join(__dirname, "/html/img"),
        dotfiles: "deny",
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": "attachment; filename=void.png",
          "Content-Length": 90,
          "Cache-Control": "no-store",
          "x-timestamp": Date.now(),
          "x-sent": true,
        },
      };
      //send the file
      let fileName = "whitepixel.png";
      res.sendFile(fileName, options, function (err) {
        if (err) {
          console.log(err);
          connection.end();
        } else {
          console.log("File Sent:", fileName);
          connection.end();
          return;
        }
      });
      return;
    }
    // configure the sending
    let options = {
      root: path.join(__dirname, "upload"),
      dotfiles: "deny",
      headers: {
        "Content-Type": rows[0].mimetype,
        "Content-Disposition":
          "attachment; filename=" + rows[0].originalfilename,
        "Content-Length": rows[0].size,
        "Cache-Control": "no-store",
        "x-timestamp": Date.now(),
        "x-sent": true,
      },
    };
    //send the file
    let fileName = rows[0].urlfile;
    res.sendFile(fileName, options, function (err) {
      if (err) {
        console.log(err);
        connection.end();
      } else {
        console.log("File Sent:", fileName);
        connection.end();
        return;
      }
    });
  });
  // send back the signature image using the signaturetoken for authentication
  // the signature token is unique for each users and it's a shareable authentication token
  app.get("/publicsignature", async function (req, res) {
    // parameters required
    const token = req.query.t;
    // check security token
    if (typeof token === "undefined") {
      console.log('ERROR: The authentication token "t" is missing');
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // authenticate the token searching for it on the users table
    //const q="select signaturefullname,signatureinitials,signaturefontname,urlfile,originalfilename,size,mimetype from users,scannedsignatures where signaturetoken=? and users.account=scannedsignatures.account and type='S'"
    let q = "select * from users where signaturetoken=?";
    let [rows, fields] = await connection.execute(q, [token]);
    if (rows.length == 0) {
      const answer = '{"answer":"KO","message":"invalid authentication token"}';
      console.log("answer:", answer);
      await connection.end();
      res.send(answer);
      console.log("returning back");
      return;
    }
    const account = rows[0].account;
    const signaturefullname = rows[0].signaturefullname;
    const signatureinitials = rows[0].signatureinitials;
    const signaturefontname = rows[0].signaturefontname;
    // search for scanned signature
    q = "select * from scannedsignatures where account=? and type='S'";
    let mimetype = "";
    let fileName = "";
    let originalfilename = rows[0].originalfilename;
    let sizef = 0;
    [rows, fields] = await connection.execute(q, [account]);
    if (rows.length > 0) {
      mimetype = rows[0].mimetype;
      fileName = rows[0].urlfile;
      originalfilename = rows[0].originalfilename;
      sizef = rows[0].size;
    }

    // Send scanned image when set
    if (signaturefontname == "SCANNED" && fileName.length > 0) {
      // configure the sending
      let options = {
        root: path.join(__dirname, "upload"),
        dotfiles: "deny",
        headers: {
          "Content-Type": mimetype,
          "Content-Disposition": "attachment; filename=" + originalfilename,
          "Content-Length": sizef,
          "Cache-Control": "no-store",
          "x-timestamp": Date.now(),
          "x-sent": true,
        },
      };
      //send the file
      res.sendFile(fileName, options, function (err) {
        if (err) {
          console.log(err);
          connection.end();
        } else {
          console.log("File Sent:", fileName);
          connection.end();
          return;
        }
      });
    } else {
      // send image generated from font
      // set the font
      let fontname = "fonts/standardsignature/Thesignature.ttf";
      if (signaturefontname.length > 0) {
        fontname = signaturefontname;
      }
      // set the name
      let name = "Name Not Configured";
      if (signaturefullname.length > 0) name = signaturefullname;
      //convert the font to base64
      fontname = "./html/" + fontname;
      //console.log("signature fontname:",fontname);
      //console.log("signature name:",name);
      const _data = await encodeToDataUrl(fontname);
      const html = `
            <html>
            <head>
                <style>
                @font-face {
                    font-family: 'standardfont';
                    src: url(${_data}) format('woff2'); 
                }
                body {
                    width: 300px;
                    height: 48px;
                }
                </style>
            </head>
            <body>  
            <p style="font-family: standardfont; font-size:48px">${name}</p>
            </body
            </html>`;
      const image = await nodeHtmlToImage({ html: html,puppeteerArgs:{ args: ['--no-sandbox','--disable-setuid-sandbox'] } });
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(image, "binary");
      console.log("Signature generated from font has been sent");
      connection.end();
      return;
    }
  });
  // get the private key ED25519 used to encrypt/decrypt documents
  app.get("/getprivatekey", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request getprivatekey");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request getprivatekey");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      console.log("answer:", answer);
      await connection.end();
      res.send(answer);
      console.log("returning back");
      return;
    }
    // make query for   (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from users where account=?",
      [account]
    );
    if (rows.length == 0) {
      const answer =
        '{"answer":"KO","message":"something is wrong, user not found"}';
      console.log("answer:", answer);
      await connection.end();
      res.send(answer);
      return;
    }
    const answer = {
      encryptionkey: rows[0].encryptionkey,
    };
    const as = JSON.stringify(answer);
    console.log("Sending Answer:", as);
    await connection.end();
    res.send(as);
    return;
  });
  // save the private key ED25519 used to encrypt/decrypt documents
  app.get("/saveprivatekey", async function (req, res) {
    // parameters required
    const token = req.query.token;
    const account = req.query.account;
    const privatekey = req.query.privatekey;
    // check security token
    if (typeof token === "undefined") {
      console.log("ERROR: Missing token in request saveprivatekey");
      const answer = '{"answer":"KO","message":"token is mandatory"}';
      res.send(answer);
      return;
    }
    // check account
    if (typeof account === "undefined") {
      console.log("ERROR: Missing account in request saveprivatekey");
      const answer = '{"answer":"KO","message":"account is mandatory"}';
      res.send(answer);
      return;
    }
    // check privatekey
    if (typeof privatekey === "undefined") {
      console.log("ERROR: Missing privatekey in request saveprivatekey");
      const answer = '{"answer":"KO","message":"privatekey is mandatory"}';
      res.send(answer);
      return;
    }
    let connection = await opendb();
    // check validity of the security token for the requested account
    const isValidToken = await check_token_validity(token, account, connection);
    if (!isValidToken) {
      const answer = '{"answer":"KO","message":"Token is not valid"}';
      console.log("answer:", answer);
      await connection.end();
      res.send(answer);
      console.log("returning back");
      return;
    }
    // make query for   (sql injection is managed)
    const [rows, fields] = await connection.execute(
      "select * from users where account=?",
      [account]
    );
    if (rows.length == 0) {
      const answer =
        '{"answer":"KO","message":"something is wrong, user not found"}';
      console.log("answer:", answer);
      await connection.end();
      res.send(answer);
      return;
    }
    await connection.execute(
      "update users set encryptionkey=? where account=?",
      [privatekey, account]
    );
    const answer = '{"answer":"OK","message":"Private key has been saved"}';
    console.log("Sending Answer:", answer);
    await connection.end();
    res.send(answer);
    return;
  });

  // various upload functions are grouped here
  // manage signature upload
  app.post("/uploadsignature", upload.array("files"), uploadsignature);
  // manage initials upload
  app.post("/uploadinitials", upload.array("files"), uploadinitials);
  // manage upload of files
  app.post("/upload", upload.array("files"), uploadFiles);

  // default reading origin if the path does not match any above
  // ATTENTION:be careful to start the server from the right folder
  // TODO: add check for the existance of the folder html at the start
  // get files from html folder
  app.use(express.static("html"));

  //listen on port 3000
  // a reverse proxy like nginx is necessary to use https.
  let server = app.listen(3000, function () {});
}
// section of functions outside the app.() express section
// function to manage the uploaded files
async function uploadFiles(req, res) {
  //console.log("req.body",req.body);
  console.log("req.files", req.files);
  console.log("req.files[0]", req.files[0]);
  // check parameters
  let account = req.body.account;
  let token = req.body.token;
  let template = req.body.template;
  if (typeof account === "undefined") {
    res.send('{"answer":"KO","message":"account is mandatory" }');
  }
  if (typeof token === "undefined") {
    res.send('{"answer":"KO","message":"token is mandatory" }');
  }
  let connection = await opendb();
  // check validity of the security token for the requested account
  const isValidToken = await check_token_validity(token, account, connection);
  if (!isValidToken) {
    const answer = '{"answer":"KO","message":"Token is not valid"}';
    await connection.end();
    res.send(answer);
    return;
  }

  for (let i = 0; i < req.files.length; i++) {
    console.log("req.files[i].orginalname", req.files[i].originalname);
    console.log("req.files[i].filename", req.files[i].filename);
    //computer hash
    const fileBuffer = fs.readFileSync("upload/" + req.files[i].filename);
    const hashSum = crypto.createHash("sha256");
    hashSum.update(fileBuffer);
    const hash = hashSum.digest("hex");
    if (template == "yes") {
      let content = fs.readFileSync("upload/" + req.files[i].filename);
      await connection.execute(
        "insert into templates set creator=?,description=?,content=?,dtlastupdate=now()",
        [account, req.files[i].originalname, content]
      );
    } else {
      //generate public view token
      let publicviewtoken = crypto.randomBytes(32).toString("hex");
      await connection.execute(
        "insert into documents set account=?,description=?,originalfilename=?,urlfile=?,size=?,mimetype=?,hash=?,dtlastupdate=now(),publicviewtoken=?",
        [
          account,
          req.files[i].originalname,
          req.files[i].originalname,
          req.files[i].filename,
          req.files[i].size,
          req.files[i].mimetype,
          hash,
          publicviewtoken,
        ]
      );
    }
  }
  await connection.end();
  res.send('{"answer":"OK","message":"Successfully uploaded files" }');
  return;
}

// function to check the validity of the security token received
async function check_token_validity(token, account, connection) {
  const [rows, fields] = await connection.execute(
    "select * from users where account=? and token=? and time_to_sec(timediff(now(),dttoken))<=3600",
    [account, token]
  );
  if (rows.length == 0) {
    return false;
  }
  //update the dttoken to keep the session open
  await connection.execute(
    "update users set dttoken=now() where account=? and token=?",
    [account, token]
  );
  return true;
}
//functiont to update the status
async function update_status_documents_drafts(account, connection) {
  const [rows, fields] = await connection.execute(
    "select * from documents where (account=? or counterpart=?) and status='draft'",
    [account, account]
  );
  console.log("********* update status drafts");
  console.log(rows);
  for (let i = 0; i < rows.length; i++) {
    const hash = await api.query.docSig.documents(account, rows[i].id);
    const hashstring = `${hash}`;
    console.log("hashstring", hashstring);
    if (hashstring !== "0x") {
      await connection.execute(
        "update documents set status='waiting' where id=?",
        [rows[i].id]
      );
      console.log("Status changed to 'waiting' for document id:", rows[i].id);
    }
    console.log(rows[i].counterpart, rows[i].id);
    const hashc = await api.query.docSig.signatures(
      rows[i].counterpart,
      rows[i].id
    );
    const hashstringc = `${hashc}`;
    console.log("hashstringc", hashstringc);
    if (hashstringc !== "0x") {
      await connection.execute(
        "update documents set status='waiting' where id=?",
        [rows[i].id]
      );
      console.log(
        "Status changed to 'waiting' for document id (counterpart):",
        rows[i].id
      );
    }
  }
  return;
}
//functiont to update the status for document in waiting
async function update_status_documents_waiting(account, connection) {
  console.log("Checking for approved change");
  const [rows, fields] = await connection.execute(
    "select * from documents where (account=? or counterpart=?) and status='waiting'",
    [account, account]
  );
  console.log("record found: ", rows.length);
  for (let i = 0; i < rows.length; i++) {
    let hash = await api.query.docSig.documents(rows[i].account, rows[i].id);
    let hashstring = `${hash}`;
    console.log("hashstring", hashstring);
    if (hashstring !== "0x") {
      hash = await api.query.docSig.signatures(rows[i].counterpart, rows[i].id);
      hashstring = `${hash}`;
      console.log("hashstring", hashstring);
      if (hashstring !== "0x") {
        await connection.execute(
          "update documents set status='approved' where id=?",
          [rows[i].id]
        );
        console.log(
          "Status changed to 'completed' for document id:",
          rows[i].id
        );
      }
    }
  }
  return;
}
// get the unique tags from templates
function getUniqueTags(rows) {
  // Join all tags into a single string
  let i = 0;
  let x = rows.length;
  let allTags = "";
  for (i = 0; i < x; i++) {
    if (i > 0) allTags = allTags + ",";
    allTags = allTags + rows[i].tags;
  }
  // Split the string into an array of individual tags
  const individualTags = allTags.split(",");
  // Create a Set to eliminate duplicate tags
  const uniqueTagsSet = new Set(individualTags);
  // Convert the Set back to an array
  let uniqueTagsArray = Array.from(uniqueTagsSet);
  return uniqueTagsArray.sort();
}
// function to ge the font list from the folder html/fonts/
async function get_fonts_list() {
  const folderPath = "html/fonts/";
  let f = fs.readdirSync(folderPath);
  const x = f.length;
  let fr = [];
  for (let i = 0; i < x; i++) {
    if (f[i][0] == ".") continue;
    // search for font file name
    let dpath = folderPath + f[i] + "/";
    //console.log(dpath);
    let ffn = await get_font_filename(dpath);
    if (ffn.length > 0) {
      ffn = ffn.replace("html/", "");
      if (ffn.length > 0) fr.push(ffn);
    }
  }
  return fr;
}
// function to search for font file name in a path
async function get_font_filename(folderPath) {
  let f = fs.readdirSync(folderPath);
  const x = f.length;
  let fr = [];
  for (let i = 0; i < x; i++) {
    if (f[i].includes(".ttf") || f[i].includes(".otf")) {
      return folderPath + f[i];
    }
  }
  return "";
}
// function to manage the signature upload
async function uploadsignature(req, res) {
  console.log("req.body", req.body);
  //console.log("req.files",req.files);
  // check parameters
  let account = req.body.account;
  let token = req.body.token;

  if (typeof account === "undefined") {
    res.send('{"answer":"KO","message":"account is mandatory" }');
    console.log('{"answer":"KO","message":"account is mandatory" }');
    return;
  }
  if (typeof token === "undefined") {
    res.send('{"answer":"KO","message":"token is mandatory" }');
    console.log('{"answer":"KO","message":"token is mandatory" }');
    return;
  }
  let connection = await opendb();
  // check validity of the security token for the requested account
  const isValidToken = await check_token_validity(token, account, connection);
  if (!isValidToken) {
    const answer = '{"answer":"KO","message":"Token is not valid"}';
    await connection.end();
    res.send(answer);
    return;
  }
  // store the scanned image
  let i = 0;
  console.log("req.files[i].orginalname", req.files[i].originalname);
  console.log("req.files[i].filename", req.files[i].filename);
  //computer hash
  const fileBuffer = fs.readFileSync("upload/" + req.files[i].filename);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  const hash = hashSum.digest("hex");
  console.log("hash", hash);
  //search for previous scanned signature
  const [rows, fields] = await connection.execute(
    "select * from scannedsignatures where account=? and type='S'",
    [account]
  );
  // insert new record
  if (rows.length == 0) {
    await connection.execute(
      "insert into scannedsignatures set account=?,type='S',originalfilename=?,urlfile=?,size=?,mimetype=?,hash=?,dtlastupdate=now()",
      [
        account,
        req.files[i].originalname,
        req.files[i].filename,
        req.files[i].size,
        req.files[i].mimetype,
        hash,
      ]
    );
  } else {
    //update an existing record
    await connection.execute(
      "update scannedsignatures set originalfilename=?,urlfile=?,size=?,mimetype=?,hash=?,dtlastupdate=now() where account=? and type='S'",
      [
        req.files[i].originalname,
        req.files[i].filename,
        req.files[i].size,
        req.files[i].mimetype,
        hash,
        account,
      ]
    );
  }
  await connection.end();
  res.send('{"answer":"OK","message":"File has been uploaded" }');
  return;
}
// function to manage the initials upload
async function uploadinitials(req, res) {
  console.log("req.body", req.body);
  //console.log("req.files",req.files);
  // check parameters
  let account = req.body.account;
  let token = req.body.token;

  if (typeof account === "undefined") {
    res.send('{"answer":"KO","message":"account is mandatory" }');
    console.log('{"answer":"KO","message":"account is mandatory" }');
    return;
  }
  if (typeof token === "undefined") {
    res.send('{"answer":"KO","message":"token is mandatory" }');
    console.log('{"answer":"KO","message":"token is mandatory" }');
    return;
  }
  let connection = await opendb();
  // check validity of the security token for the requested account
  const isValidToken = await check_token_validity(token, account, connection);
  if (!isValidToken) {
    const answer = '{"answer":"KO","message":"Token is not valid"}';
    await connection.end();
    res.send(answer);
    return;
  }
  // store the file in temporary location for showing and later saving
  let i = 0;
  console.log("req.files[i].orginalname", req.files[i].originalname);
  console.log("req.files[i].filename", req.files[i].filename);
  //computer hash
  const fileBuffer = fs.readFileSync("upload/" + req.files[i].filename);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  const hash = hashSum.digest("hex");
  console.log("hash", hash);
  //search for previous scanned signature
  const [rows, fields] = await connection.execute(
    "select * from scannedsignatures where account=? and type='I'",
    [account]
  );
  // insert new record
  if (rows.length == 0) {
    await connection.execute(
      "insert into scannedsignatures set account=?,type='I',originalfilename=?,urlfile=?,size=?,mimetype=?,hash=?,dtlastupdate=now()",
      [
        account,
        req.files[i].originalname,
        req.files[i].filename,
        req.files[i].size,
        req.files[i].mimetype,
        hash,
      ]
    );
  } else {
    //update an existing record
    await connection.execute(
      "update scannedsignatures set originalfilename=?,urlfile=?,size=?,mimetype=?,hash=?,dtlastupdate=now() where account=? and type='I'",
      [
        req.files[i].originalname,
        req.files[i].filename,
        req.files[i].size,
        req.files[i].mimetype,
        hash,
        account,
      ]
    );
  }
  await connection.end();
  res.send('{"answer":"OK","message":"File has been uploaded" }');
  return;
}
// function to open the db
async function opendb() {
  let connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PWD,
    database: DB_NAME,
    multipleStatements: true,
  });
  return connection;
}
// custom parser for signature rendering in dcs files
  function signatureParser(block){
    return `<img src="${block.data.url}" alt="${block.data.caption}">`;
  }
