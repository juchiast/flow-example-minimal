"use client";
import {
  WalletDisconnectButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import SolanaWalletProvider from "./providers/SolanaWalletProvider";
import { FC, useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { encode as base58Encode } from "bs58";
import { restClient, wsClient } from "./utils/client";
import { StartFlowUnverifiedOutput } from "@space-operator/client/dist/module/types/rest/start-flow-unverified";
import { Value } from "@space-operator/client/dist/module/types/values";

const StartFlowButton: FC = () => {
  const { publicKey, signTransaction } = useWallet();
  const [logs, setLogs] = useState([]);

  const subscribeEvents = useCallback(
    ({ flow_run_id, token }: StartFlowUnverifiedOutput) => {
      wsClient.subscribeFlowRunEvents(
        async (ev) => {
          setLogs((logs) => [...logs, ev]);
          if (ev.event === "SignatureRequest") {
            const tx = ev.data.buildTransaction();
            const pk = new PublicKey(ev.data.pubkey);

            // sign and check if the wallet has changed the transaction
            const signedTx = await signTransaction(tx);
            const signature = signedTx.signatures.find((ele) =>
              ele.publicKey.equals(pk)
            ).signature;
            const before = tx.serializeMessage();
            const after = signedTx.serializeMessage();
            if (!before.equals(after)) {
              console.log(ev.data.id, tx, signedTx);
              alert("tx changed");
              return;
            }
            restClient.submitSignature({
              id: ev.data.id,
              signature: base58Encode(signature),
            });
          }
        },
        flow_run_id,
        token
      );
    },
    [setLogs, signTransaction]
  );

  const startFlow = useCallback(async () => {
    setLogs([]);
    if (!publicKey) return;
    const body = await restClient.startFlowUnverified(1892, publicKey, {
      inputs: {
        sender: new Value({ B3: publicKey.toBase58() }),
      },
    });
    if (body.error == null) {
      subscribeEvents(body as StartFlowUnverifiedOutput);
    } else {
      alert(`start failed: ${body.error}`);
    }
  }, [publicKey, setLogs, subscribeEvents]);
  return (
    <>
      {signTransaction && <button onClick={startFlow}>Start Flow</button>}
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
