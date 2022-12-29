import * as alt from "alt-client"
import { Rpc } from "./class"
export { Rpc } from "./class"

export const rpc = new Rpc({
  eventApi: {
    emitServer: alt.emitServer,
    offServer: alt.offServer,
    onServer: alt.onServer,
  },
})
