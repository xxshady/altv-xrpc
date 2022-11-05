# altv-xrpc

## Installation

### yarn

server-side
```
yarn add altv-xrpc-server
```
client-side
```
yarn add altv-xrpc-client
```
webview
```
yarn add altv-xrpc-webview
```
types
```
yarn add altv-xrpc-shared-types
```

### npm

server-side
```
npm install altv-xrpc-server
```
client-side
```
npm install altv-xrpc-client
```
webview
```
npm install altv-xrpc-webview
```
advanced typescript support
```
yarn add altv-xrpc-shared-types
```

## Usage

Mini-example of `altv-xrpc-shared-types` usage is [here](/example)

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
