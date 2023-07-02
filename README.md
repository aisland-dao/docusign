# Docusign 
A Dapp to sign and exchange documents notarized on the blockchain.
It's based on [Substrate framework](https:/substrate.dev) for the blockchain and
[Polkadot.js](https://polkadot.js.org/extension/) for the wallet extension.  
  
A live demo is available at:  
[https://docusign.aisland.io](https://docusign.aisland.io)  
The demo works on the testnet of [Aisland blockchain](https://aisland.io).  
  
You can use the faucet available at:  
[https://testnet.aisland.io:8443](https://testnet.aisland.io:8443) to get some AISC tokens for free.  
  
## Requirements:
- [Nodejs >18.x](https://nodejs.org)  
- [Mariadb Server](https://mariadb.org)

##Installation

- install Nodejs following the instructions on the official website  
- install Mariadb  
- create a database named: docusign with:  
```bash
mysql
create database docusign;
exit;
```
import the database schema with:  
```bash
mysql docusign < create_database_tables.sql
```
create a a database user:  
```
CREATE USER 'docusign'@'localhost' IDENTIFIED BY 'your_passord';
GRANT ALL PRIVILEGES ON docusign.* TO 'docusign'@'localhost';
FLUSH PRIVILEGES;
```
edit the file docusign-server.sh and customize with your password.  

```bash
install the dependencies for nodejs:  
```bash
npm install
```

## Run
```bash
./docusign-server.sh
```
you will be able to reache the user interface browsing:  
http://localhost:3000  

You may install a reverse proxy like Nginx to manage the https connections.  







