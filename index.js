var Web3 = require('web3');
var Tx = require('ethereumjs-tx').Transaction;
const delay = require('delay');

var Common = require('ethereumjs-common').default;
var BSC_FORK = Common.forCustomChain(
    'mainnet',
    {
        name: 'Binance Smart Chain Mainnet',
        networkId: 56,
        chainId: 56,
        url: 'https://bsc-dataseed.binance.org/'
    },
    'istanbul',
);
var web3 = new Web3(new Web3.providers.HttpProvider('https://bsc-dataseed.binance.org/'))

const contractabi = require('./contract.json');
const amazonabi = require('./Amazon.json');

function createAccounts(){
    const accounts =[];

    for (var i = 0 ; i< 1; i++){
        var account = web3.eth.accounts.create();
        console.log("Address:", account.address);
        console.log("PrivateKey:", account.privateKey);
        accounts.push(account); 
    }
    return accounts; 
}


// Send funds from master to test wallets.
const sendFunds = async (addr, toAddress, amount, privateKey) =>{
    console.log(`Attempting to make transaction from ${addr} to ${toAddress}`);
    const createTransaction = await web3.eth.accounts.signTransaction(
        {
           from: addr,
           to: toAddress,
           value: web3.utils.toWei(amount, 'ether'),
           gas: '21000',
        },
        privateKey
     );
     // Deploy transaction
     const createReceipt = await web3.eth.sendSignedTransaction(
        createTransaction.rawTransaction
     );
     console.log(
        `Transaction successful with hash: ${createReceipt.transactionHash}`
     );
}

// Swap BNB with Token
const swapTokenWithBNB = async (Address, PRIVATE_KEY, Amount) =>{
    const addresses = {
        Amazone: '0x3c18F6C2aff81a6489327DA5b0d4FB5ed5695801',
        WBNB:"0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        PANCAKE_ROUTER: '0x10ed43c718714eb63d5aa57b78b54704e256024e'
    }
    var amountToBuyWith = web3.utils.toHex(Amount);
    var amountOutMin = web3.utils.toHex(Amount*1900);
    var contract = new web3.eth.Contract(contractabi, addresses.PANCAKE_ROUTER, {from: Address});
    var data = contract.methods.swapExactETHForTokens(
        web3.utils.toHex(amountOutMin),
        [addresses.WBNB, addresses.Amazone],
        Address,
        web3.utils.toHex(Math.round(Date.now()/1000)+60*20),
    );
    var count = await web3.eth.getTransactionCount(Address);
    var rawTransaction = {
        "from":Address,
        "gasPrice":web3.utils.toHex(5000000000),
        "gasLimit":web3.utils.toHex(290000),
        "to":addresses.PANCAKE_ROUTER,
        "value":amountToBuyWith,
        "data":data.encodeABI(),
        "nonce":web3.utils.toHex(count)
    };

    var transaction = new Tx(rawTransaction, { 'common': BSC_FORK });
    var privateKey = Buffer.from(PRIVATE_KEY, 'hex')  ;
    transaction.sign(privateKey);

    var result = await web3.eth.sendSignedTransaction('0x' + transaction.serialize().toString('hex'));
    console.log(result.transactionHash);
}
// Swap Token with BNB
const swapBNBWithToken = async (Address, PRIVATE_KEY, Amount) =>{
    const addresses = {
        Amazone: '0x3c18F6C2aff81a6489327DA5b0d4FB5ed5695801',
        WBNB:"0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        PANCAKE_ROUTER: '0x10ed43c718714eb63d5aa57b78b54704e256024e'
    }
    var amountToSellWith = web3.utils.toHex(Amount);
    var amountOutMin = web3.utils.toHex(Amount/2100);
    var contract = new web3.eth.Contract(contractabi, addresses.PANCAKE_ROUTER, {from: Address});
    const account = web3.eth.accounts.privateKeyToAccount('0x' + PRIVATE_KEY);
    web3.eth.accounts.wallet.add(account);
    web3.eth.defaultAccount = account.address;
    //Approve the token before swap
    const amazon = new web3.eth.Contract(amazonabi, addresses.Amazone, {from: Address});
    await amazon.methods.approve(addresses.PANCAKE_ROUTER, amountToSellWith)
        .send({from:web3.eth.defaultAccount, gasPrice:web3.utils.toHex(5000000000),gasLimit:web3.utils.toHex(290000),}, function(err, result) {
            if (err) console.error(err);
            else console.log("Approve:", result);
    });
   
    var data = contract.methods.swapExactTokensForETH(
        web3.utils.toHex(amountToSellWith),
        web3.utils.toHex(amountOutMin),
        [addresses.Amazone, addresses.WBNB],
        Address,
        web3.utils.toHex(Math.round(Date.now()/1000)+60*20),
    );
    var count =  (await web3.eth.getTransactionCount(Address) + 1);
    var rawTransaction = {
        "from":Address,
        "gasPrice":web3.utils.toHex(5000000000),
        "gasLimit":web3.utils.toHex(290000),
        "to":addresses.PANCAKE_ROUTER,
        "value":"0x0",
        "data":data.encodeABI(),
        "nonce":web3.utils.toHex(count)
    };

    var transaction = new Tx(rawTransaction, { 'common': BSC_FORK });
    var privateKey = Buffer.from(PRIVATE_KEY, 'hex')  ;
    transaction.sign(privateKey);

    var result = await web3.eth.sendSignedTransaction('0x' + transaction.serialize().toString('hex'));
    console.log(result.blockHash);
}

async function Main(){
    let privateKey = "Your key here";
    const accounts = createAccounts();
    for (var i = 0 ; i<accounts.length ; i++){
        await sendFunds("Your address", accounts[i].address,"0.005", privateKey)
        await swapTokenWithBNB(accounts[i].address, accounts[i].privateKey.split("0x")[1], 1);
    }
    delay(1000);
    for (var i = 0 ; i<accounts.length ; i++){
        await swapBNBWithToken(accounts[i].address, accounts[i].privateKey.split("0x")[1], 2100)
    }
}

Main();