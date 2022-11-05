import { rpc } from "altv-xrpc-client"

rpc.emitServer("example", 123)
rpc.emitServer("example", "123") // Argument of type "string" is not assignable to parameter of type "number".
rpc.emitServer("example") // Expected 2 arguments
