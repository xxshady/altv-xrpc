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

rpc.onServer("example", (data) => data)
rpc.emitServer("example", 123)
  .then(result => alt.log("rpc result:", result))
  .catch(e => alt.logError("something went wrong", e.stack)
```

### server
```ts
import * as alt from "alt-server"
import { rpc } from "altv-xrpc-server"

rpc.onClient("example", (data) => data)
rpc.emitClient(alt.Player.all[0], "example", 123)
  .then(result => alt.log("rpc result:", result))
  .catch(e => alt.logError("something went wrong", e.stack))
```
