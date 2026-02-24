// src/hooks/useWallet.ts
// wallet connection and transaction hook using mobile wallet adapter
import { useState, useCallback, useMemo } from "react";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import { useWalletStore } from "../stores/wallet-store";

const APP_IDENTITY = {
  name: "SolScan",
  uri: "https://solscan-app.com",
  icon: "favicon.ico",
};

// decode base64 address to PublicKey (phantom returns base64 encoded addresses)
const decodeAddress = (address: string): PublicKey => {
  if (address.includes("=") || address.includes("+") || address.includes("/")) {
    const bytes = Uint8Array.from(atob(address), (c) => c.charCodeAt(0));
    return new PublicKey(bytes);
  }
  return new PublicKey(address);
};

export function useWallet() {
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const isDevnet = useWalletStore((s) => s.isDevnet);
  const connectedPublicKey = useWalletStore((s) => s.connectedPublicKey);
  const setConnectedPublicKey = useWalletStore((s) => s.setConnectedPublicKey);

  const publicKey = useMemo(() => {
    if (!connectedPublicKey) return null;
    try {
      return new PublicKey(connectedPublicKey);
    } catch {
      return null;
    }
  }, [connectedPublicKey]);

  const cluster = isDevnet ? "devnet" : "mainnet-beta";
  const connection = new Connection(clusterApiUrl(cluster), "confirmed");

  // ============================================
  // CONNECT — Ask Phantom to authorize our app
  // ============================================
  const connect = useCallback(async () => {
    console.log("[useWallet] connect() called, cluster:", cluster);
    setConnecting(true);

    try {
      const walletAddress = await transact(async (wallet: Web3MobileWallet) => {
        console.log("[useWallet] calling wallet.authorize...");

        const authResult = await wallet.authorize({
          cluster: cluster,
          identity: APP_IDENTITY,
        });

        console.log("[useWallet] authorize successful");

        if (!authResult.accounts || authResult.accounts.length === 0) {
          throw new Error("No accounts returned from wallet authorization");
        }

        const userAddress = authResult.accounts[0].address;
        console.log("[useWallet] raw address:", userAddress);

        const pubkey = decodeAddress(userAddress);
        console.log("[useWallet] decoded public key:", pubkey.toBase58());

        return pubkey.toBase58();
      });

      setConnectedPublicKey(walletAddress);
      return new PublicKey(walletAddress);
    } catch (error: unknown) {
      console.error("[useWallet] connect failed:", error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [cluster, setConnectedPublicKey]);

  // ============================================
  // DISCONNECT
  // ============================================
  const disconnect = useCallback(() => {
    console.log("[useWallet] disconnect() called");
    setConnectedPublicKey(null);
  }, [setConnectedPublicKey]);

  // ============================================
  // GET BALANCE
  // ============================================
  const getBalance = useCallback(async () => {
    if (!publicKey) return 0;
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }, [publicKey, connection]);

  // ============================================
  // SEND SOL — Build, sign, and send a transaction
  // ============================================
  const sendSOL = useCallback(
    async (toAddress: string, amountSOL: number) => {
      console.log("[useWallet] sendSOL() called");
      console.log("[useWallet] to:", toAddress, "amount:", amountSOL);

      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      setSending(true);

      try {
        // step 1: get blockhash
        console.log("[useWallet] fetching blockhash...");
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        console.log("[useWallet] blockhash:", blockhash);

        // step 2: build transaction
        const toPublicKey = new PublicKey(toAddress);
        const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);
        console.log("[useWallet] lamports:", lamports);

        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: toPublicKey,
            lamports,
          })
        );
        console.log("[useWallet] transaction built");

        // step 3: sign transaction inside transact (shows wallet popup)
        console.log("[useWallet] starting transact for signing...");

        const signedTransaction = await transact(
          async (wallet: Web3MobileWallet) => {
            console.log("[useWallet] inside transact, calling authorize...");

            await wallet.authorize({
              cluster: cluster,
              identity: APP_IDENTITY,
            });
            console.log("[useWallet] authorized, calling signTransactions...");

            const signedTxs = await wallet.signTransactions({
              transactions: [transaction],
            });
            console.log("[useWallet] signTransactions completed");

            if (!signedTxs || signedTxs.length === 0) {
              throw new Error("No signed transaction returned from wallet");
            }

            return signedTxs[0];
          }
        );

        console.log("[useWallet] transaction signed, waiting before send...");

        // step 4: delay after phantom closes (network reconnect)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // step 5: send transaction with retry logic
        const rawTransaction = signedTransaction.serialize();
        console.log("[useWallet] serialized, sending to network...");

        let signature: string | null = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`[useWallet] send attempt ${attempt}...`);
            signature = await connection.sendRawTransaction(rawTransaction, {
              skipPreflight: true,
              maxRetries: 2,
            });
            console.log("[useWallet] sent, signature:", signature);
            break;
          } catch (err: unknown) {
            lastError = err as Error;
            console.log(`[useWallet] attempt ${attempt} failed:`, lastError.message);
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }

        if (!signature) {
          throw lastError || new Error("Failed to send transaction after 3 attempts");
        }

        // step 6: confirm transaction
        console.log("[useWallet] confirming transaction...");
        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          "confirmed"
        );

        if (confirmation.value.err) {
          throw new Error(
            `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
          );
        }

        console.log("[useWallet] transaction confirmed!");
        return signature;
      } catch (error) {
        console.error("[useWallet] sendSOL error:", error);
        throw error;
      } finally {
        setSending(false);
      }
    },
    [publicKey, connection, cluster]
  );

  return {
    publicKey,
    connected: !!publicKey,
    connecting,
    sending,
    connect,
    disconnect,
    getBalance,
    sendSOL,
    connection,
  };
}
