# altv-xrpc

Special thanks ❤️ to [innxz](https://github.com/innxz) for financially supporting me and this library

![Code_8rnWxzdSIY](https://user-images.githubusercontent.com/54737754/208540996-e7862b93-2b85-4d4d-9217-a68924d0b50d.gif)

altv-xrpc is a library that implements **strict** request-response events (rpc) and made for *real* TypeScript users

## Installation

### yarn

```
yarn add altv-xrpc-server
yarn add altv-xrpc-client
yarn add altv-xrpc-webview
yarn add altv-xrpc-shared
yarn add altv-xrpc-shared-types  // advanced typescript support
```

### npm

```
npm install altv-xrpc-server
npm install altv-xrpc-client
npm install altv-xrpc-webview
npm install altv-xrpc-shared
npm install altv-xrpc-shared-types // advanced typescript support
```

## Usage

Mini-example of advanced typescript support (`altv-xrpc-shared-types`) usage is [here](/example)

### client

```ts
import * as alt from "alt-client"
import { rpc } from "altv-xrpc-client"

// client <-> server
rpc.onServer("example", (data) => data)
rpc.onServer("example" (data) => 123) // error, one rpc can only have one listener
rpc.offServer("example") // remove listener
rpc.emitServer("example", 123)
  .then(result => console.log("server rpc result:", result))
  
  // possible reasons of rejection:
  // listener is running too long (more than 15 seconds) (code: Expired)
  // listener is not added for that rpc name (code: HandlerNotRegistered)
  // this rpc is already running and no response has been received yet (code: AlreadyPending)
  .catch(e => console.error("something went wrong", e.stack)

// client <-> webview
rpc.useWebView(new alt.WebView(...)) // only one WebView instance can be used

rpc.onWebView("example", (data) => data)
rpc.emitWebView("example", 123)
  .then(result => console.log("webview rpc result:", result))
  .catch(e => console.error("something went wrong", e.stack)
```

### server

```ts
import * as alt from "alt-server"
import { rpc } from "altv-xrpc-server"

// server <-> client
rpc.onClient("example", (data) => data)
rpc.emitClient(alt.Player.all[0], "example", 123)
  .then(result => alt.log("client rpc result:", result))

  // in addition to all of the above reasons of rejection, here the player can disconnect (code: PlayerDisconnected)
  .catch(e => alt.logError("something went wrong", e.stack))

// server <-> webview
rpc.onWebView("example", (data) => data)

// rpc event will be send to webview that was added using rpc.useWebView on client-side
rpc.emitWebView(alt.Player.all[0], "example", 123)
  .then(result => alt.log("webview rpc result:", result))
  // possible rejection: rpc.useWebview is not used on client-side (WebViewNotAdded)
  .catch(e => alt.logError("something went wrong", e.stack))
```

### webview

```ts
import { rpc } from "altv-xrpc-webview"

rpc.onClient("example", (data) => data)
rpc.emitClient("example", 123)
  .then(result => console.log("client rpc result:", result))
  .catch(e => console.error("something went wrong", e.stack))

rpc.onServer("example", (data) => data)
rpc.emitServer("example", 123)
  .then(result => console.log("server rpc result:", result))
  .catch(e => console.error("something went wrong", e.stack))
```

## Custom events API

By default this library uses alt:V events API (`alt.emitServer`, `alt.onClient`, etc.), but it's possible to override this behavior, for example if you want to add some protection

client-side

```ts
import { Rpc } from "altv-xrpc-client"

const myWebView = new alt.WebView(...)

const rpc = new Rpc({
  eventApi: {
    onServer: (event, handler) => {
      alt.log("rpc called onServer (add event handler) with params:", [event, handler])
      alt.onServer(event, handler)
    },
    offServer: (event, handler) => {
      alt.log("rpc called offServer (remove event handler) with params:", [event, handler])
      alt.offServer(event, handler)
    },
    emitServer: (event, ...args) => {
      alt.log("rpc called emitServer with params:", [event, args])
      alt.emitServer(event, ...args)
    },
  },
  webView: {
    on: (event, handler) => {
      alt.log("rpc called WebView on method (add event handler) with params:", [event, handler])
      myWebView.on(event, handler)
    },
    emit: (event, ...args) => {
      alt.log("rpc called WebView emit method with params:", [event, args])
      myWebView.emit(event, handler)
    },
  }
})

// Will output to the client console "rpc called emitServer with params: ["rpc:callEvent", [ "example", [ 123 ] ] ]"
rpc.emitServer("example", 123) 
```

server-side

```ts
import { Rpc } from "altv-xrpc-server"

const rpc = new Rpc({
  eventApi: {
    onClient: (event, handler) => {
      alt.log("rpc called onClient (add event handler) with params:", [event, handler])
      alt.onClient(event, handler)
    },
    offClient: (event, handler) => {
      alt.log("rpc called offClient (remove event handler) with params:", [event, handler])
      alt.offClient(event, handler)
    },
    emitClient: (player, event, ...args) => {
      alt.log("rpc called emitClient with params:", [player, event, args])
      alt.emitClient(player, event, ...args)
    },
  }
})


alt.on("playerConnect", (player) => {
  rpc.emitClient(player, "example", 123)
  // Output to the server console:
  // rpc called emitClient with params: [
  //   Player {},
  //   "rpc:callEvent",
  //   [ "test", [ 123 ] ]
  // ]
})
```

## Server-side hooks API

Easier verification of everything the client (webview) sends to the server (client->server rpc call, server->client rpc response).

server-side

```ts
import { Rpc } from "altv-xrpc-server"

const myClientServerRpcArgs = {
  a: "must be number",
  b: "must be string",
}

const myServerClientResponses = {
  a: "must be number",
  b: "must be string",
}

const rpc = new Rpc({
  hooks: {
    // server-side rpc.onClient player & args
    clientServerCall(player, rpcName, args) {
      const expected = myClientServerRpcArgs[rpcName as keyof typeof myClientServerRpcArgs]
      const [value] = args
      if (expected === "must be number" && typeof value !== "number") {
        return null // will send `InvalidClientServerArgsOrPlayer` error code to client
      }
      if (expected === "must be string" && typeof value !== "string") {
        return null
      }

      return {
        player,
        args
      }
    },

    // server-side rpc.emitClient response (returned value)
    serverClientResponse(player, rpcName, response) {
      const expected = myServerClientResponses[rpcName as keyof typeof myServerClientResponses]
      if (expected === "must be number" && typeof response !== "number") {
        return null // will reject rpc.emitClient promise with `InvalidServerClientResponse` error code
      }
      if (expected === "must be string" && typeof response !== "string") {
        return null
      }

      return { response }
    },
  }
})

// serverClientResponse
// if client sends not string this promise will be rejected
const response = await rpc.emitClient(player, "b")

```

client-side (same for webview)

```ts
import { rpc } from "altv-xrpc-client"

// will fail
// a: "must be number"
const response = await rpc.emitServer("a", null)
```

## WebView reset

For cases where `AlreadyPending` errors occur during hot reloads in browser.

Example usage for [Vite HMR](https://vitejs.dev/guide/api-hmr.html).

```ts
import { rpc } from 'altv-xrpc-webview'

const hotReload = (import.meta as any).hot
if (hotReload) {
  hotReload.on('vite:beforeUpdate', (newModule: unknown) => {
    if (!newModule) return
    rpc.reset()
  })
}
```
