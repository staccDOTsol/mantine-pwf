'use client';

import { Container, Title, Group, Box, TextInput } from '@mantine/core';
import {  useAnchorWallet } from '@solana/wallet-adapter-react';
import { ComputeBudgetProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN} from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { Button, Platform, ScrollView, Text, View } from "react-native";


export const IDL: Idl = {
  "version": "0.1.0",
  "name": "pumpinator",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "friend",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "friend",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "friend",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pump",
      "accounts": [
        {
          "name": "jare",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "friend",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "unpump",
      "accounts": [
        {
          "name": "jare",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "friend",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "Friend",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "deposited",
            "type": "u64"
          },
          {
            "name": "withdrawn",
            "type": "u64"
          },
          {
            "name": "buffer",
            "type": {
              "array": [
                "u64",
                8
              ]
            }
          }
        ]
      }
    }
  ],
  metadata: {
    address: "cAQ5uztwVrNw7Us1GbCLmsdSdQtUmwtS23mj9y5hhXy"
  },
}

export type Friend = {
  authority: PublicKey;
  withdrawn: number;
  deposited: number;
  buffer: number[];
  lamports?: number
};

const getPDA = (authority: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("friend"), authority.toBuffer()],
    new PublicKey("cAQ5uztwVrNw7Us1GbCLmsdSdQtUmwtS23mj9y5hhXy")
  );
};

import { Buffer } from "buffer";
global.Buffer = global.Buffer || Buffer;
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

const NETWORK = clusterApiUrl("mainnet-beta");

const onConnectRedirectLink = Linking.createURL("onConnect");
const onDisconnectRedirectLink = Linking.createURL("onDisconnect");
const onSignAndSendTransactionRedirectLink = Linking.createURL("onSignAndSendTransaction");
const onSignAllTransactionsRedirectLink = Linking.createURL("onSignAllTransactions");
const onSignTransactionRedirectLink = Linking.createURL("onSignTransaction");
const onSignMessageRedirectLink = Linking.createURL("onSignMessage");

const buildUrl = (path: string, params: URLSearchParams) =>
  `https://phantom.app/ul/v1/${path}?${params.toString()}`;

const decryptPayload = (data: string, nonce: string, sharedSecret?: Uint8Array) => {
  if (!sharedSecret) throw new Error("missing shared secret");

  const decryptedData = nacl.box.open.after(bs58.decode(data), bs58.decode(nonce), sharedSecret);
  if (!decryptedData) {
    throw new Error("Unable to decrypt data");
  }
  return JSON.parse(Buffer.from(decryptedData).toString("utf8"));
};

const encryptPayload = (payload: any, sharedSecret?: Uint8Array) => {
  if (!sharedSecret) throw new Error("missing shared secret");

  const nonce = nacl.randomBytes(24);

  const encryptedPayload = nacl.box.after(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    sharedSecret
  );

  return [nonce, encryptedPayload];
};




const Btn = ({ title, onPress }: { title: string; onPress: () => Promise<void> }) => {
  return (
    <View style={{ marginVertical: 10 }}>
      <Button title={title} onPress={onPress} />
    </View>
  );
};
export function Landing() {
  const [deepLink, setDeepLink] = useState<string>("");
  const connection = new Connection(process.env.NEXT_PUBLIC_MAINNET_RPC_URL as string)

  const [logs, setLogs] = useState<string[]>([]);
  const addLog = useCallback((log: string) => setLogs((logs) => [...logs, "> " + log]), []);
  const scrollViewRef = useRef<any>(null);

  // store dappKeyPair, sharedSecret, session and account SECURELY on device
  // to avoid having to reconnect users.
  const [dappKeyPair] = useState(nacl.box.keyPair());
  const [sharedSecret, setSharedSecret] = useState<Uint8Array>();
  const [session, setSession] = useState<string>();
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState<PublicKey>();

  useEffect(() => {
    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        setDeepLink(initialUrl);
      }
    })();
    Linking.addEventListener("url", handleDeepLink);
    return () => {
      Linking.removeEventListener("url", handleDeepLink);
    };
  }, []);

  const handleDeepLink = ({ url }: Linking.EventType) => {
    setDeepLink(url);
  };

  // handle inbounds links
  useEffect(() => {
    if (!deepLink) return;

    const url = new URL(deepLink);
    const params = url.searchParams;

    if (params.get("errorCode")) {
      addLog(JSON.stringify(Object.fromEntries([...params]), null, 2));
      return;
    }

    if (/onConnect/.test(url.pathname)) {
      const sharedSecretDapp = nacl.box.before(
        bs58.decode(params.get("phantom_encryption_public_key")!),
        dappKeyPair.secretKey
      );

      const connectData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecretDapp
      );

      setSharedSecret(sharedSecretDapp);
      setSession(connectData.session);
      setPhantomWalletPublicKey(new PublicKey(connectData.public_key));

      addLog(JSON.stringify(connectData, null, 2));
    } else if (/onDisconnect/.test(url.pathname)) {
      addLog("Disconnected!");
    } else if (/onSignAndSendTransaction/.test(url.pathname)) {
      const signAndSendTransactionData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecret
      );

      addLog(JSON.stringify(signAndSendTransactionData, null, 2));
    } else if (/onSignAllTransactions/.test(url.pathname)) {
      const signAllTransactionsData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecret
      );

      const decodedTransactions = signAllTransactionsData.transactions.map((t: string) =>
        Transaction.from(bs58.decode(t))
      );

      addLog(JSON.stringify(decodedTransactions, null, 2));
    } else if (/onSignTransaction/.test(url.pathname)) {
      const signTransactionData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecret
      );

      const decodedTransaction = Transaction.from(bs58.decode(signTransactionData.transaction));

      addLog(JSON.stringify(decodedTransaction, null, 2));
    } else if (/onSignMessage/.test(url.pathname)) {
      const signMessageData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecret
      );

      addLog(JSON.stringify(signMessageData, null, 2));
    }
  }, [deepLink]);

  const createTransferTransaction = async () => {
    if (!phantomWalletPublicKey) throw new Error("missing public key from user");
    let transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: phantomWalletPublicKey,
        toPubkey: phantomWalletPublicKey,
        lamports: 100,
      })
    );
    transaction.feePayer = phantomWalletPublicKey;
    addLog("Getting recent blockhash");
    const anyTransaction: any = transaction;
    anyTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return transaction;
  };

  const connect = async () => {
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      cluster: "mainnet-beta",
      app_url: "https://phantom.app",
      redirect_link: onConnectRedirectLink,
    });

    const url = buildUrl("connect", params);
    Linking.openURL(url);
  };

  const disconnect = async () => {
    const payload = {
      session,
    };
    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: onDisconnectRedirectLink,
      payload: bs58.encode(encryptedPayload),
    });

    const url = buildUrl("disconnect", params);
    Linking.openURL(url);
  };

  const signAndSendTransaction = async (transaction: Transaction) => {

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
    });

    const payload = {
      session,
      transaction: bs58.encode(serializedTransaction),
    };
    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: onSignAndSendTransactionRedirectLink,
      payload: bs58.encode(encryptedPayload),
    });

    addLog("Sending transaction...");
    const url = buildUrl("signAndSendTransaction", params);
    Linking.openURL(url);
  };

  const signAllTransactions = async () => {
    const transactions = await Promise.all([
      createTransferTransaction(),
      createTransferTransaction(),
    ]);

    const serializedTransactions = transactions.map((t) =>
      bs58.encode(
        t.serialize({
          requireAllSignatures: false,
        })
      )
    );

    const payload = {
      session,
      transactions: serializedTransactions,
    };

    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: onSignAllTransactionsRedirectLink,
      payload: bs58.encode(encryptedPayload),
    });

    addLog("Signing transactions...");
    const url = buildUrl("signAllTransactions", params);
    Linking.openURL(url);
  };

  const signTransaction = async () => {
    const transaction = await createTransferTransaction();

    const serializedTransaction = bs58.encode(
      transaction.serialize({
        requireAllSignatures: false,
      })
    );

    const payload = {
      session,
      transaction: serializedTransaction,
    };

    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: onSignTransactionRedirectLink,
      payload: bs58.encode(encryptedPayload),
    });

    addLog("Signing transaction...");
    const url = buildUrl("signTransaction", params);
    Linking.openURL(url);
  };

  const signMessage = async () => {
    const message = "To avoid digital dognappers, sign below to authenticate with CryptoCorgis.";

    const payload = {
      session,
      message: bs58.encode(Buffer.from(message)),
    };

    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: onSignMessageRedirectLink,
      payload: bs58.encode(encryptedPayload),
    });

    addLog("Signing message...");
    const url = buildUrl("signMessage", params);
    Linking.openURL(url);
  };

  const wallet = useAnchorWallet();
  const [friendAccount, setFriendAccount] = useState<Friend | null>(null);
  const [friendAccounts, setFriendAccounts] =useState<Friend[]> ([])
  const [disabled, setDisabled] = useState(false)
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<Program | null>(null)
  const [amount, setAmount] = useState<string>("1");
  const [switchy, setSwitchy] = useState(false)
  const [myFs, setMyFs] = useState<any[]>([])
  const [allFs, setAllFs] = useState<any[]>([])
  const [image, setImage] = useState<File | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const uploadToIPFS = async () => {
    setDisabled(true)
    const ixs = [SystemProgram.transfer({
      fromPubkey: wallet?.publicKey as PublicKey,
      toPubkey: new PublicKey("7ihN8QaTfNoDTRTQGULCzbUT3PHwPDTu5Brcu4iT2paP"),
      lamports: 0.04 * LAMPORTS_PER_SOL
    }),
    SystemProgram.transfer({
      fromPubkey: wallet?.publicKey as PublicKey,
      toPubkey: new PublicKey("Czbmb7osZxLaX5vGHuXMS2mkdtZEXyTNKwsAUUpLGhkG"),
      lamports: 0.96 * LAMPORTS_PER_SOL
    }),
  ]
    const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({microLamports: 94000})).add(...ixs)
tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
tx.feePayer = wallet?.publicKey as PublicKey
    await signAndSendTransaction(tx)
    const formData = new FormData();
    formData.append('image', image as File, 'image.png');// Make sure to provide the correct file name and type
  
    const metadata = {
      name: name || "Stacc",
      symbol: symbol || "STACC",
      description: "lol.",
      seller_fee_basis_points: 0,
      image: "https://stacc.infura-ipfs.io/ipfs/QmWULmbyNyDPiQrmSvxozjxg4KvbwtSnSxpxtT5T7M4WFZ",
      external_url: "https://x.com/STACCoverflow/status/1794794736873525572",
      attributes: [],
      properties: {
        files: [
          {
            uri: "https://stacc.infura-ipfs.io/ipfs/QmWULmbyNyDPiQrmSvxozjxg4KvbwtSnSxpxtT5T7M4WFZ",
            type: "image/png"
          }
        ],
        category: "image"
      }
    };
  
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
    try {
      const response = await fetch('https://api.pumpwithfriens.fun/upload', {
        method: 'POST',
        body: formData
      });
  
      if (response.ok) {
        const data = await response.json();
        console.log('Image CID:', data.imageCid);
        console.log('Metadata CID:', data.metadataCid);
        console.log('Metadata URI:', data.metadataUri);
      } else {
        console.error('Failed to upload files to IPFS');
      }
    } catch (error) {
      console.error('Error uploading files to IPFS:', error);
    }
  };
  useEffect(() => {

  const buy_quote = (a: number, virtual_sol_reserves: number, virtual_token_reserves: number) => {

    const sol_cost = ((a * virtual_sol_reserves) / (virtual_token_reserves - a)) ;
    return sol_cost + 1; // always round up
  };
    const fetchFriendAccount = async () => {
      if (!wallet) return
      if (!wallet.publicKey) {
        setLoading(false);
        return;
      }

      const [friendPDA] = await getPDA(wallet.publicKey);
      const friendInfo = await connection.getAccountInfo(friendPDA);
      const provider = new AnchorProvider(connection, wallet, {})
      const program = new Program (IDL as Idl, new PublicKey("cAQ5uztwVrNw7Us1GbCLmsdSdQtUmwtS23mj9y5hhXy"), provider)
      setProgram(program)
      if (friendInfo) {
        const friendData = program.coder.accounts.decode<Friend>('Friend', friendInfo.data);
        setFriendAccount({
          lamports: friendInfo.lamports,
          ...friendData
        });
        const fs = (await connection.getParsedTokenAccountsByOwner(friendPDA, {programId: TOKEN_PROGRAM_ID})).value

        for (const friend of fs){ 
          if (parseInt(friend.account.data.parsed.info.tokenAmount.amount) > 0){
        const mint = friend.account.data.parsed.info.mint;
        setMyFs([...myFs, {
          quote: friend.account.data.parsed.info.tokenAmount.amount,
          mint
        }])
      }
        }
      } else {
        setFriendAccount(null);
      }

      setLoading(false);
    };

    fetchFriendAccount();

  const getProgramAccounts = async () => {
    const friends = await connection.getProgramAccounts(new PublicKey("cAQ5uztwVrNw7Us1GbCLmsdSdQtUmwtS23mj9y5hhXy"));
    for (const f of friends) {
      if (!program) return
      const friendData = program.coder.accounts.decode<Friend>('Friend', f.account.data);
      setFriendAccounts([...friendAccounts, {
        ...friendData,
        lamports: f.account.lamports
      }])
      const fs = (await connection.getParsedTokenAccountsByOwner(f.pubkey, {programId: TOKEN_PROGRAM_ID})).value
      for (const friend of fs){ 
        if (parseInt(friend.account.data.parsed.info.tokenAmount.amount) > 0){
      const mint = friend.account.data.parsed.info.mint;
     
      setAllFs([...allFs, {
        quote: friend.account.data.parsed.info.tokenAmount.amount,
        mint
      }])
    }
      }
    }
  };
   getProgramAccounts();
  }, [wallet && wallet.publicKey, switchy]);

  if (loading) {
    return <Text>Loading...</Text>;
  }
  const deposit = async () => {

    if (!wallet) return 
    if (!program || !wallet.publicKey) {
      console.error("Wallet not connected or program not loaded");
      return;
    }

    try {
      const [friendPDA] = await getPDA(wallet.publicKey);
      const tx = await program.methods.deposit(new BN(parseInt(amount) * 10 ** 9)).accounts({
          authority: wallet.publicKey,
          friend: friendPDA,
          systemProgram: SystemProgram.programId,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({microLamports: 64000})
      ])
      .rpc();
      console.log("Deposit transaction signature", tx);
    } catch (error) {
      console.error("Failed to deposit:", error);
    }
  };
  const withdraw = async () => {
    if (!wallet) return 
    if (!program || !wallet.publicKey) {
      console.error("Wallet not connected or program not loaded");
      return;
    }

    try {
      const [friendPDA] = await getPDA(wallet.publicKey);
      const tx = await program.methods.withdraw(new BN(parseInt(amount) * 10 ** 9)).accounts({
          authority: wallet.publicKey,
          friend: friendPDA,
          systemProgram: SystemProgram.programId,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({microLamports: 64000})
      ])
      .rpc()
      console.log("Withdraw transaction signature", tx);
    } catch (error) {
      console.error("Failed to withdraw:", error);
    }
  };

    const init = async () => {
      if (!wallet || !program || !wallet.publicKey) {
        console.error("Wallet not connected or program not loaded");
        return;
      }

      try {
        const [friendPDA] = await getPDA(wallet.publicKey);
        const ix = await program.methods.initialize().accounts({
            authority: wallet.publicKey,
            friend: friendPDA,
            systemProgram: SystemProgram.programId,
        })
        .instruction();

    const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({microLamports: 94000})).add(ix)
    tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
    tx.feePayer = wallet?.publicKey as PublicKey
        await signAndSendTransaction(tx);
        setSwitchy(true)
        setTimeout(async function(){
          setSwitchy(false)
        }, 10000)
        console.log("Initialize transaction signature", tx);
      } catch (error) {
        console.error("Failed to initialize account:", error);
      }
    };
    
  return (
    <Container size="md" pb="xl">

<View style={{ flex: 0, paddingTop: 20, paddingBottom: 40 }}>
        <Btn title="Connect" onPress={connect} />
        <Btn title="Disconnect" onPress={disconnect} />
        
      </View>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            backgroundColor: "#111",
            padding: 20,
            paddingTop: 100,
            flexGrow: 1,
          }}
          ref={scrollViewRef}
          onContentSizeChange={() => {
            scrollViewRef.current.scrollToEnd({ animated: true });
          }}
          style={{ flex: 1 }}
        >
          {logs.map((log, i) => (
            <Text
              key={`t-${i}`}
              style={{
                fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
                color: "#fff",
                fontSize: 14,
              }}
            >
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>
      <Title>
        {friendAccount ? 'Friend Account Details' : 'Create Friend Account'}
      </Title>
      {friendAccount ? (
        <>
          <Text>Deposited: {(friendAccount.deposited / LAMPORTS_PER_SOL).toString()} sol</Text>
          <Text>Withdrawn: {(friendAccount.withdrawn / LAMPORTS_PER_SOL).toString()} sol</Text>
          <Text>Balance: {(friendAccount.lamports ? friendAccount.lamports  / LAMPORTS_PER_SOL : 0).toString()} sol</Text>
          {myFs.map((f: any) => (
              <div key={f.mint}>
              <Text>{f.mint}: {(f.quote / 10 ** 6).toString() }</Text>
            </div>
          ))}
          <Group>
            <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button onClick={deposit}>Deposit</Button>
            <Button onClick={withdraw}>Withdraw</Button>
          </Group>
        <Box mt="xl">
          <Title>Create PumpWithFriens on Pump.fun</Title>
          <Group>
            <TextInput placeholder="Name" value={name ? name : ''} onChange={(e) => setName(e.target.value)} />
            <TextInput placeholder="Ticker" value={symbol ? symbol : ''} onChange={(e) => setSymbol(e.target.value)} />
            <input type="file" accept="image/png" onChange={(e) => {
              // @ts-ignore
              setImage(e.target.files[0])}
             } />
                        <Button disabled={disabled} onClick={uploadToIPFS}>Respect the Pump for 1 Sol</Button>
          </Group>
        </Box>
        {friendAccounts.map((account, index) => (
          <Box key={index} mt="xl">
            <Title>{`Friend ${index + 1} Account Details`}</Title>
            <Text>Deposited: {(account.deposited / LAMPORTS_PER_SOL).toString()} sol</Text>
            <Text>Withdrawn: {(account.withdrawn / LAMPORTS_PER_SOL).toString()} sol</Text>
            {allFs.map((f: any) => (
              <div key={f.mint}>
                 <Text>{f.mint}: {(f.quote / 10 ** 6).toString() }</Text>

              </div>
          ))}
          </Box>
        ))}
        </>
      ) : (
        <Button onClick={init}>Initialize Account</Button>
      )}
    </Container>
  );
}
