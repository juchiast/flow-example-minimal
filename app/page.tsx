"use client";
import {
  WalletDisconnectButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import SolanaWalletProvider from "./providers/SolanaWalletProvider";
import { FC, useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Message, PublicKey, Transaction } from "@solana/web3.js";
import { encode as base58Encode } from "bs58";

// const HOST = "localhost:8080";
const HOST = "dev-api.spaceoperator.com";

const SSL = HOST.startsWith("localhost") ? "" : "s";

interface StartResult {
  flow_run_id: String;
  token: String;
}

const StartFlowButton: FC = () => {
  const { publicKey, signTransaction } = useWallet();
  const [logs, setLogs] = useState([]);
  const connectWs = useCallback(
    ({ flow_run_id, token }: StartResult) => {
      let socket = new WebSocket(`ws${SSL}://${HOST}/ws`);
      socket.onopen = () => {
        socket.send(JSON.stringify({ Authenticate: { token } }));
        socket.send(
          JSON.stringify({
            SubscribeFlowRunEvents: { flow_run_id },
          })
        );
      };
      socket.onmessage = async (ev) => {
        const event = JSON.parse(ev.data).event;
        if (!event) return;
        setLogs((logs) => [...logs, event]);

        if (event.req_id) {
          const pk = new PublicKey(event.pubkey);
          const buffer = Buffer.from(event.message, "base64");
          const solMsg = Message.from(buffer);
          const tx = Transaction.populate(solMsg);
          const signedTx = await signTransaction(tx);
          console.log(tx, signedTx);
          const signature = signedTx.signatures.find((ele) =>
            ele.publicKey.equals(pk)
          ).signature;

          const resp = await fetch(`http${SSL}://${HOST}/signature/submit`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              id: event.req_id,
              signature: base58Encode(signature),
            }),
          });

          const respBody = await resp.json();
          if (!respBody.success) alert("submit failed");
        }

        if (event.content?.FlowFinish) {
          console.log("closing");
          socket.close();
        }
      };
      socket.onclose = () => {
        console.log("closed");
      };
    },
    [setLogs, signTransaction]
  );
  const startFlow = useCallback(async () => {
    if (!publicKey) return;
    setLogs([]);
    const resp = await fetch(
      `http${SSL}://${HOST}/flow/start_unverified/1846`,
      {
        method: "POST",
        headers: {
          authorization: publicKey.toBase58(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            sender: {
              B3: publicKey.toBase58(),
            },
          },
        }),
      }
    );
    const body: StartResult = await resp.json();
    connectWs(body);
  }, [publicKey, setLogs]);
  return (
    <>
      <button onClick={startFlow}>Start Flow</button>
      <table>
        <tbody>
          {logs.map((log, index) => (
            <tr key={index}>
              <td>{JSON.stringify(log)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

export default function Page() {
  return (
    <SolanaWalletProvider>
      <WalletMultiButton></WalletMultiButton>
      <WalletDisconnectButton></WalletDisconnectButton>
      <StartFlowButton></StartFlowButton>
    </SolanaWalletProvider>
  );
}
