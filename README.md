# altv-xrpc

## Installation

### yarn
```
yarn add altv-xrpc-server
```
```
yarn add altv-xrpc-client
```

### npm
```
npm install altv-xrpc-server
```
```
npm install altv-xrpc-client
```


## Usage

### client
```ts
import * as alt from "alt-client"
import { rpc } from "altv-xrpc-client"

// client <-> server
rpc.onServer("example", (data) => data)
rpc.emitServer("example", 123)
  .then(result => console.log("server rpc result:", result))
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
  .catch(e => alt.logError("something went wrong", e.stack))

// server <-> webview
rpc.onWebView("example", (data) => data)

// rpc event will be send to webview that was added using rpc.useWebView on client-side
rpc.emitWebView(alt.Player.all[0], "example", 123)
  .then(result => alt.log("webview rpc result:", result))
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
