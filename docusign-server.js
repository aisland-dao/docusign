// Docusign Server
const express = require('express');
const cookieParser = require("cookie-parser");
let fs=require("fs");
const path = require('path');
let crypto = require('node:crypto');
let mysql = require('mysql2/promise');
let  utilcrypto =require('@polkadot/util-crypto');
let util=require("@polkadot/util");
const multer = require("multer");
const { ApiPromise, WsProvider } = require('@polkadot/api');
const upload = multer({ dest: "upload/" });
const edjsHTML = require("editorjs-html");
let connection;
let api;
const provider = new WsProvider('wss://testnet.aisland.io');




//setuw web express
let app = express();
app.use(cookieParser());
const DB_HOST = process.env.DB_HOST
const DB_NAME = process.env.DB_NAME
const DB_USER = process.env.DB_USER
const DB_PWD = process.env.DB_PWD
const WALLET = process.env.WALLET
const FEES=process.env.FEES;

// set default to local host if not set
if (typeof DB_HOST === 'undefined') {
    console.log(Date.now(), "[Error] the environment variable DB_HOST is not set.");
    process.exit(1);
}
// DB_NAME is mandatory
if (typeof DB_NAME === 'undefined') {
    console.log(Date.now(), "[Error] the environment variable DB_NAME is not set.");
    process.exit(1);
}
// DB_USER is mandatory
if (typeof DB_USER === 'undefined') {
    console.log(Date.now(), "[Error] the environment variable DB_USER is not set.");
    process.exit(1);
}
// DB_PWD is mandatory
if (typeof DB_PWD === 'undefined') {
    console.log(Date.now(), "[Error] the environment variable DB_PWD is not set.");
    process.exit(1);
}

console.log("Docusign Server - v.1.00");
console.log("Listening on port tcp/3000 ....");
mainloop();
// main body
async function mainloop(){
    //connect database
    connection = await mysql.createConnection({
        host     : DB_HOST,
        user     : DB_USER,
        password : DB_PWD,
        database : DB_NAME,
        multipleStatements : true
    });
    // connect to the node
    api = await ApiPromise.create({ provider });
    // Retrieve the chain & node information information via rpc calls
    const [chain, nodeName, nodeVersion] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version()
    ]);
    console.log("Connected to: "+chain +" - "+nodeName+" - "+nodeVersion);
    // main page is dex.html with a permannet redirect
    app.get('/', async function (req, res) {
       res.redirect(301, 'index.html');     
    });
    // main page is dex.html with a permannet redirect
    app.get('/signin', async function (req, res) {
        const signature=req.query.signature;
        const token=req.query.data;
        const account=req.query.account;
        console.log("account ",account,"token ",token,"signature ",signature);
        // verify signature
        const { isValid } = utilcrypto.signatureVerify(token, signature, account);
        if(isValid==false){
            console.log("ERROR: Invalid Signature");
            res.send('{"answer":"KO","message":"The signature is not matching the account, please check your configuration."}');
            return;
        }
        // store in DB
        // check for the same account in the table
        const [rows, fields] = await connection.execute('select * from users where account=?',[account]);
        if(rows.length==0){
            await connection.execute('insert into users set account=?,token=?,dttoken=now()',[account,token]);
        }else{
            await connection.execute('update users set account=?,token=?,dttoken=now()',[account,token]);   
        }
        // confirm the signin
        console.log("Signin confirmed");
        res.send('{"answer":"OK","message":"signin completed"}');
        return;

    });
    // function to return the documents in draft status 
    app.get('/documentsdrafts', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request documentsdrafts");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request documentsdrafts");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        //update status
        await update_status_documents_drafts(account);
        // make query for draft documents (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from documents where account=? and status='draft' order by dtlastupdate desc",[account]);
        // send the back the records in json format
        res.send(JSON.stringify(rows));
        return;
    });
    // function to return the documents in waiting status 
    app.get('/documentswaiting', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        let signaturetoken=req.cookies.signaturetoken;
        if(typeof signaturetoken ==='undefined'){
                signaturetoken='xxxxxxxxxxxxxxxxxxxxxxxxxxxx'; //unused token
        }
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request documentswaiting");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request documentswaiting");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        update_status_documents_waiting(account);

        console.log("account: ",account,"signaturetoken: ",signaturetoken);
        // make query for waiting documents (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from documents where (account=? and status='waiting') or (signaturetoken=? and (status='waiting' or status='draft')) order by dtlastupdate desc",[account,signaturetoken]);
        console.log(JSON.stringify(rows));
        // send the back the records in json format
        res.send(JSON.stringify(rows));
        return;
    });
    // function to return the documents in action required status 
    app.get('/documentsactionrequired', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request documentsactionrequired");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request documentsactionrequired");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for draft documents (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from documents where account=? and status='action' order by dtlastupdate desc",[account]);
        // send the back the records in json format
        res.send(JSON.stringify(rows));
        return;
    });
    // function to return the documents in approved status
    app.get('/documentsapproved', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request documentsapproved");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request documentsapproved");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for draft documents (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from documents where (account=? or counterpart=?) and status='approved' order by dtlastupdate desc",[account,account]);
        // send the back the records in json format
        res.send(JSON.stringify(rows));
        return;
    });
    // function to set the signaturetoken in a cookie and redirect to index.html
    app.get('/sign', async function (req, res) {
        // parameters required
        const signaturetoken=req.query.signaturetoken;
        // set cookie with signaturetoken
        if(typeof signaturetoken !== 'undefined'){
            res.cookie('signaturetoken', signaturetoken);
        }
        // redirect to main UI
        res.redirect(302, '/index.html');     
    });
    // function to return the documents in approved status
    app.get('/documentsrejected', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        let signaturetoken=req.cookies.signaturetoken;
        if(typeof signaturetoken ==='undefined'){
            signaturetoken='xxxxxxxxxxxxxxxxxxxxxxxxxxx'; //unsed code
        }
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request documentsrejected");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request documentsrejected");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for draft documents (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from documents where (account=? or counterpart=? or signaturetoken=?) and status='rejected' order by dtlastupdate desc",[account,account,signaturetoken]);
        // send the back the records in json format
        console.log("documentsrejected:",JSON.stringify(rows));
        res.send(JSON.stringify(rows));
        return;
    });
    // document view
    app.get('/docview', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        const documentid=req.query.documentid;
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request docview");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request docview");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check documentid
        if(typeof documentid ==='undefined'){
            console.log("ERROR: Missing documentid in request docview");
            const answer='{"answer":"KO","message":"documentid is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for draft documents (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from documents where account=? and id=?",[account,documentid]);
        if(rows.length==0){
            const answer='{"answer":"KO","message":"documentid not found for the account authenticated"}';
            res.send(answer);
            return;
        }
        // configure the sending
        let options = {
            root: path.join(__dirname, 'upload'),
            dotfiles: 'deny',
            headers: {
              'Content-Type': rows[0].mimetype,
              'Content-Disposition': 'inline; filename='+rows[0].originalfilename,
              'Content-Length':rows[0].size,
              'x-timestamp': Date.now(),
              'x-sent': true,
            }
          }
        // check .dcs files
        const originalfilename=rows[0].originalfilename;
        //console.log("originalfilename",originalfilename);
        if(originalfilename.slice(-4)=='.dcs'){
            // convert the file to html for rendering
            // Initialize the parser
            //console.log("special processing for .dcs");
            const edjsParser = edjsHTML();
            const fileNameDcs='upload/'+rows[0].urlfile;
            //console.log("fileNameDcs:",fileNameDcs);
            const contentFile=fs.readFileSync(fileNameDcs);
            const contentFileObj=JSON.parse(contentFile.toString())
            //console.log("contentFileObj",contentFileObj);
            const html = edjsParser.parse(contentFileObj);
            //console.log("html",html);
            let optionsDcs = {
                headers: {
                  'Content-Type': 'text/html',
                  'Content-Disposition': 'inline; filename='+rows[0].originalfilename,
                  'Content-Length':rows[0].size,
                  'x-timestamp': Date.now(),
                  'x-sent': true,
                }
            }
            let c='';
            let i=0;
            const x=html.length;
            for (i=0;i<x;i++){
                c=c+html[i];
            }
            res.send(c,optionsDcs, function (err) {
                if (err) {
                    console.log('ERROR:'+err);
                } else {
                    console.log('INFO: File Sent:', fileName);
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
                console.log('File Sent:', fileName);
                return;
            }
        });
    });
    // template view
    app.get('/templateview', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        const documentid=req.query.documentid;
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request docview");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request docview");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check documentid
        if(typeof documentid ==='undefined'){
            console.log("ERROR: Missing documentid in request docview");
            const answer='{"answer":"KO","message":"documentid is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for templates (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from templates where id=?",[documentid]);
        if(rows.length==0){
            const answer='{"answer":"KO","message":"documentid not found"}';
            res.send(answer);
            return;
        }
        const edjsParser = edjsHTML();
        const contentFileObj=JSON.parse(rows[0].content)    
        const html = edjsParser.parse(contentFileObj);
        console.log("html",html);
        let options = {
            headers: {
                'Content-Type': 'text/html',
                'x-timestamp': Date.now(),
                'x-sent': true,
            }
        }
        let c='';
        let i=0;
        const x=html.length;
        for (i=0;i<x;i++){
            c=c+html[i];
        }
        console.log("c",c);
        res.send(c,options, function (err) {
            if (err) {
                console.log('ERROR:'+err);
            } else {
                console.log('INFO: File Sent:', fileName);
                return;
            }
        });
        return;
    });
    // template data
    app.get('/templatedata', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        const documentid=req.query.documentid;
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request docview");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request docview");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check documentid
        if(typeof documentid ==='undefined'){
            console.log("ERROR: Missing documentid in request docview");
            const answer='{"answer":"KO","message":"documentid is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for templates (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from templates where id=?",[documentid]);
        if(rows.length==0){
            const answer='{"answer":"KO","message":"documentid not found"}';
            res.send(answer);
            return;
        }        
        let options = {
            headers: {
                'Content-Type': 'text/json',
                'x-timestamp': Date.now(),
                'x-sent': true,
            }
        }
        res.send(rows[0].content,options, function (err) {
            if (err) {
                console.log('ERROR:'+err);
            } else {
                console.log('INFO: File Sent:', fileName);
                return;
            }
        });
        return;
    });
    // document delete
    app.get('/docdelete', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        const documentid=req.query.documentid;
        console.log(account,documentid);
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request docdelete");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request docdelete");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check documentid
        if(typeof documentid ==='undefined'){
            console.log("ERROR: Missing documentid in request docdelete");
            const answer='{"answer":"KO","message":"documentid is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for draft documents (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from documents where account=? and id=? and status='draft'",[account,documentid]);
        if(rows.length==0){
            const answer='{"answer":"KO","message":"documentid in draft not found for the account authenticated"}';
            res.send(answer);
            return;
        }
        console.log("Document to delete:",rows[0]);
        const filename='upload/'+rows[0].urlfile;
        //delete the file
        if (fs.existsSync(filename)) {        
                fs.unlinkSync(filename);
        }
        // delete the record
        await connection.execute("delete from documents where account=? and id=? and status='draft'",[account,documentid]);
        //return message to client
        const answer='{"answer":"OK","message":"document deleted"}';
        res.send(answer);
        return;
    });
    // document reject
    app.get('/docreject', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        const documentid=req.query.documentid;
        let signaturetoken=req.cookies.signaturetoken;
        if(typeof signaturetoken ==='undefined'){
            signaturetoken='xxxxxxxxxxxxxxxxxxx';
        }
        console.log(account,documentid);
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request docreject");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request docreject");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check documentid
        if(typeof documentid ==='undefined'){
            console.log("ERROR: Missing documentid in request docreject");
            const answer='{"answer":"KO","message":"documentid is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for draft documents (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from documents where (account=? or counterpart=? or signaturetoken=?) and id=? and status='waiting'",[account,account,signaturetoken,documentid]);
        if(rows.length==0){
            const answer='{"answer":"KO","message":"documentid in waiting not found for the account authenticated:'+account+' id: '+documentid+'"}';
            res.send(answer);
            return;
        }
        console.log("Document to reject:",rows[0]);
        
        // reject
        await connection.execute("update documents set status='rejected' where (account=? or counterpart=? or signaturetoken=?) and id=? and status='waiting'",[account,account,signaturetoken,documentid]);
        //return message to client
        const answer='{"answer":"OK","message":"document rejected"}';
        res.send(answer);
        return;
    });
    // document link
    app.get('/doclink', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        const documentid=req.query.documentid;
        console.log(account,documentid);
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request docreject");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request docreject");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check documentid
        if(typeof documentid ==='undefined'){
            console.log("ERROR: Missing documentid in request docreject");
            const answer='{"answer":"KO","message":"documentid is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for draft documents (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from documents where account=? and id=? and (status='draft' or status='waiting')",[account,documentid]);
        if(rows.length==0){
            const answer='{"answer":"KO","message":"documentid not found for the account authenticated"}';
            res.send(answer);
            return;
        }
        console.log("Document to generate link:",rows[0]);
        let signaturetoken='';
        if(rows[0].signaturetoken.length==0){
            signaturetoken = crypto.randomBytes(32).toString('hex');
            console.log("signaturetoken",signaturetoken);
            await connection.execute("update documents set status='waiting',signaturetoken=? where account=? and id=? and status='draft'",[signaturetoken,account,documentid]);
            await connection.execute("update documents set signaturetoken=? where account=? and id=?",[signaturetoken,account,documentid]);
        }
        else {
            signaturetoken=rows[0].signaturetoken;
            await connection.execute("update documents set status='waiting' where account=? and id=? and status='draft'",[account,documentid]);
        }
        console.log("signaturetoken 2",signaturetoken);
        //return message to client
        const answer='{"answer":"OK","signaturetoken":"'+signaturetoken+'"}';

        res.send(answer);
        return;
    });
    // function to return the documents in approved status
    app.get('/templates', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request documentsrejected");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request documentsrejected");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query to get templates 
        const [rows, fields] = await connection.execute("select * from templates order by description");
        // send the back the records in json format
        console.log("templates:",JSON.stringify(rows));
        res.send(JSON.stringify(rows));
        return;
    });
    // function to return the documents in approved status
    app.get('/templatestags', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request documentsrejected");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request documentsrejected");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query to get templates 
        const [rows, fields] = await connection.execute("select tags from templates");
        // send the back the records in json format
        const tags=getUniqueTags(rows);
        res.send(JSON.stringify(tags));
        return;
    });
    // function to update the document description
    app.get('/updatedocumentdescription', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        const documentid=req.query.documentid;
        const description=req.query.description;
        
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request updatedocumentdescription");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request updatedocumentdescription");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check documentid
        if(typeof documentid ==='undefined'){
            console.log("ERROR: Missing documentid in request updatedocumentdescription");
            const answer='{"answer":"KO","message":"documentid is mandatory"}';
            res.send(answer);
            return;
        }
        // check description
        if(typeof description ==='undefined'){
            console.log("ERROR: Missing description in request updatedocumentdescription");
            const answer='{"answer":"KO","message":"description is mandatory"}';
            res.send(answer);
            return;
        }
        if(description.length==0){
            console.log("ERROR: Missing description in request updatedocumentdescription");
            const answer='{"answer":"KO","message":"description is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for draft documents (sql injection is managed)
        const [rows, fields] = await connection.execute("update documents set description=? where account=? and id=?",[description,account,documentid]);
        const answer='{"answer":"OK","message":"description has been updated"}';
        res.send(answer);
        return;
    });
    // function to update the document description
    app.get('/updatedocumentcounterpart', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        const documentid=req.query.documentid;
        const documentaccount=req.query.documentaccount;
        if(account==documentaccount){
            const answer='{"answer":"OK","message":"account is already the main countepart"}';
            res.send(answer);
            return;
        }
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request updatedocumentcounterpart");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request updatedocumentcounterpart");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check documentid
        if(typeof documentid ==='undefined'){
            console.log("ERROR: Missing documentid in request updatedocumentcounterpart");
            const answer='{"answer":"KO","message":"documentid is mandatory"}';
            res.send(answer);
            return;
        }
        // check documentaccount
        if(typeof documentaccount ==='undefined'){
            console.log("ERROR: Missing documentaccount in request updatedocumentcounterpart");
            const answer='{"answer":"KO","message":"description is mandatory"}';
            res.send(answer);
            return;
        }
        if(documentaccount.length==0){
            console.log("ERROR: Missing documentaccount in request updatedocumentcounterpart");
            const answer='{"answer":"KO","message":"description is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // update the counterpart field
        const [rows, fields] = await connection.execute("update documents set counterpart=? where account=? and id=?",[account,documentaccount,documentid]);
        const answer='{"answer":"OK","message":"counterpart has been updated"}';
        res.send(answer);
        return;
    });
    // document download
    app.get('/docdownload', async function (req, res) {
        // parameters required
        const token=req.query.token;
        const account=req.query.account;
        const documentid=req.query.documentid;
        // check security token
        if(typeof token ==='undefined'){
            console.log("ERROR: Missing token in request docdownload");
            const answer='{"answer":"KO","message":"token is mandatory"}';
            res.send(answer);
            return;
        }
        // check account
        if(typeof account ==='undefined'){
            console.log("ERROR: Missing account in request docdownload");
            const answer='{"answer":"KO","message":"account is mandatory"}';
            res.send(answer);
            return;
        }
        // check documentid
        if(typeof documentid ==='undefined'){
            console.log("ERROR: Missing documentid in request docdownload");
            const answer='{"answer":"KO","message":"documentid is mandatory"}';
            res.send(answer);
            return;
        }
        // check validity of the security token for the requested account
        const isValidToken= await check_token_validity(token,account,connection);
        if(!isValidToken){
            const answer='{"answer":"KO","message":"Token is not valid"}';
            res.send(answer);
            return;
        }
        // make query for draft documents (sql injection is managed)
        const [rows, fields] = await connection.execute("select * from documents where account=? and id=?",[account,documentid]);
        if(rows.length==0){
            const answer='{"answer":"KO","message":"documentid not found for the account authenticated"}';
            res.send(answer);
            return;
        }
        // configure the sending
        let options = {
            root: path.join(__dirname, 'upload'),
            dotfiles: 'deny',
            headers: {
              'Content-Type': rows[0].mimetype,
              'Content-Disposition': 'attachment; filename='+rows[0].originalfilename,
              'Content-Length':rows[0].size,
              'x-timestamp': Date.now(),
              'x-sent': true,
            }
          }
        //send the file
        let fileName = rows[0].urlfile;
        res.sendFile(fileName, options, function (err) {
            if (err) {
                console.log(err);
            } else {
                console.log('File Sent:', fileName);
                return;
            }
        });
    });

    // manage upload of files
    app.post("/upload", upload.array("files"), uploadFiles);

    // default reading origin if the path does not match any above
    // ATTENTION:be careful to start the server from the right folder
    // TODO: add check for the existance of the folder html at the start
    // get files from html folder
    app.use(express.static('html'));

    //listen on port 3000
    // a reverse proxy like nginx is necessary to use https.
    let server = app.listen(3000, function () { });
}
// function to manage the uploaded files
async function uploadFiles(req, res) {
    //console.log("req.body",req.body);
    console.log("req.files",req.files);
    console.log("req.files[0]",req.files[0]);
    // check parameters
    let account=req.body.account;
    let token=req.body.token;
    if(typeof account === 'undefined'){
        res.send('{"answer":"KO","message":"account is mandatory" }');
    }
    if(typeof token === 'undefined'){
        res.send('{"answer":"KO","message":"token is mandatory" }');
    }
    // check validity of the security token for the requested account
    const isValidToken= await check_token_validity(token,account);
    if(!isValidToken){
        const answer='{"answer":"KO","message":"Token is not valid"}';
        res.send(answer);
        return;
    }
    
    for(let i=0;i<req.files.length;i++) {
        console.log("req.files[i].orginalname",req.files[i].originalname);
        console.log("req.files[i].filename",req.files[i].filename);
        //computer hash
        const fileBuffer = fs.readFileSync('upload/'+req.files[i].filename);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hash = hashSum.digest('hex');
        await connection.execute('insert into documents set account=?,description=?,originalfilename=?,urlfile=?,size=?,mimetype=?,hash=?,dtlastupdate=now()',[account,req.files[i].originalname,req.files[i].originalname,req.files[i].filename,req.files[i].size,req.files[i].mimetype,hash]);
    }
    res.send('{"answer":"OK","message":"Successfully uploaded files" }');
}

// function to check the validity of the security token received
async function check_token_validity(token,account){
    const [rows, fields] = await connection.execute('select * from users where account=? and token=? and time_to_sec(timediff(now(),dttoken))<=3600',[account,token]);
    if(rows.length==0){
        return(false);
    }
    //update the dttoken to keep the session open
    await connection.execute('update users set dttoken=now() where account=? and token=?',[account,token]);
    return(true);
}
//functiont to update the status
async function update_status_documents_drafts(account){
    const [rows, fields] = await connection.execute("select * from documents where account=? and status='draft'",[account]);
    for(let i=0;i<rows.length;i++){
        const hash = await api.query.docuSign.documents(account,rows[i].id);
        const hashstring=`${hash}`
        console.log("hashstring",hashstring);
        if(hashstring!=='0x'){
            await connection.execute("update documents set status='waiting' where id=?",[rows[i].id])
            console.log("Status changed to 'waiting' for document id:",rows[i].id);
        }
    }
    return;
}
//functiont to update the status for document in waiting
async function update_status_documents_waiting(account){
    console.log("Checking for approved change")
    const [rows, fields] = await connection.execute("select * from documents where (account=? or counterpart=?) and status='waiting'",[account,account]);
    console.log("record found: ",rows.length);
    for(let i=0;i<rows.length;i++){
        let hash = await api.query.docuSign.signatures(account,rows[i].id);
        let hashstring=`${hash}`
        console.log("hashstring",hashstring);
        if(hashstring!=='0x'){
            await connection.execute("update documents set status='approved' where id=?",[rows[i].id])
            console.log("Status changed to 'completed' for document id:",rows[i].id);
        }
        hash = await api.query.docuSign.signatures(rows[i].counterpart,rows[i].id);
        hashstring=`${hash}`
        console.log("hashstring",hashstring);
        if(hashstring!=='0x'){
            await connection.execute("update documents set status='approved' where id=?",[rows[i].id])
            console.log("Status changed to 'completed' for document id:",rows[i].id);
        }
    }
    return;
}
function getUniqueTags(rows) {
    // Join all tags into a single string
    let i=0;
    let x=rows.length;
    let allTags='';
    for(i=0;i<x;i++) {
        if(i>0)
            allTags=allTags+',';
        allTags=allTags+rows[i].tags;
    }
    // Split the string into an array of individual tags
    const individualTags = allTags.split(',');
    // Create a Set to eliminate duplicate tags
    const uniqueTagsSet = new Set(individualTags);
    // Convert the Set back to an array
    let uniqueTagsArray = Array.from(uniqueTagsSet);
    return uniqueTagsArray.sort();
  }
  
