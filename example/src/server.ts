import { rpc } from "altv-xrpc-server"

rpc.onClient("example", (player, a) => {
  return "str"
})

// Type 'number' is not assignable to type 'string'
rpc.onClient("example", (player, a) => 123)
