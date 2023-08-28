# Docsig 
A Dapp to sign and exchange documents notarized on the blockchain.
It's based on [Substrate framework](https:/substrate.dev) for the blockchain and
[Polkadot.js](https://polkadot.js.org/extension/) for the wallet extension.  
  
A live demo is available at:  
[https://docsig.aisland.io](https://docsig.aisland.io)  
The demo works on the testnet of [Aisland blockchain](https://aisland.io).  
  
You can use the faucet available at:  
[https://testnet.aisland.io:8443](https://testnet.aisland.io:8443) to get some AISC tokens for free.  
  
## Requirements:
- [Nodejs >18.x](https://nodejs.org)  
- [Mariadb Server](https://mariadb.org)

## Installation

- install Nodejs following the instructions on the official website  
- install Mariadb  
- on Linux Ubuntu/Debian you will need build-essential package:  
```
apt-get install build-essential
```
- create a database named: docsig with:  
```bash
mysql
create database docsig;
exit;
```
import the database schema with:  
```bash
mysql docsig < create_database_tables.sql
```
create a a database user:  
```
CREATE USER 'docsig'@'localhost' IDENTIFIED BY 'your_passord';
GRANT ALL PRIVILEGES ON docsig.* TO 'docsig'@'localhost';
FLUSH PRIVILEGES;
```
edit the file docsig-server.sh and customize with your password.  

```bash
install the dependencies for nodejs:  
```bash
npm install
```

## Run
```bash
./docsig-server.sh
```
you will be able to reache the user interface browsing:  
http://localhost:3000  

You may install a reverse proxy like Nginx to manage the https connections.  


## Unit Tests
A set of of unit tests on main core functions and API is avaible and requires to run the API server with some dummy data:
- in one session run the testing environment executing:  
```
./test.sh
```
if everyworks, you should see the node server running:  
```
DocSig Server - v.1.00
Listening on port tcp/3000 ....
```
open a new session and execute:  
```
npm test
```
you should see:  
```
Test Suites: 1 passed, 1 total
Tests:       30 passed, 30 total
Snapshots:   0 total
Time:        1.704 s, estimated 2 s
```
After the test, close the first session, stopping the API server and  cleanup the dummy database and data,executing:  
```
./test_clean.sh
```

## Docker
- Requirements: [docker composer](https://www.docker.com)
- 
You can run the docker containers with the following commands:  
```
npm install
docker compose up -d
```
The dapp will be accessible browsing:  
```
http://localhost:3000
```

## Customisations:
If you wish to change the client code, you should edit the files in client-src and launch ./build.sh to rebuild the bundle.js whichn









