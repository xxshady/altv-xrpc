import type { RpcEventName, RemotePendingController } from "altv-xrpc-shared"

export type PendingEvents = Map<RpcEventName, RemotePendingController>
