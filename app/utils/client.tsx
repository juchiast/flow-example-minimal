import { Client, WsClient } from "@space-operator/client";

export const restClient = new Client({
  url: "http://localhost:8080",
});

export const wsClient = new WsClient({
  url: "ws://localhost:8080/ws",
});
wsClient.setLogger(console.log);
