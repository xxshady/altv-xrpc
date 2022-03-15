# altv-xrpc

## Installation

### yarn
```
yarn add altv-xxrpc-server
```
```
yarn add altv-xxrpc-client
```

### npm
```
npm install altv-xxrpc-server
```
```
npm install altv-xxrpc-client
```


## Usage

### client
```ts
import * as alt from "alt-client"
import { rpc } from "altv-xxrpc-client"

rpc.onServer("example", (data) => data)
rpc.emitServer("example", 123)
  .then(result => alt.log("rpc result:", result))
  .catch(e => alt.logError("something went wrong", e.stack)
```

### server
```ts
import * as alt from "alt-server"
import { rpc } from "altv-xxrpc-server"

rpc.onClient("example", (data) => data)
rpc.emitClient(alt.Player.all[0], "example", 123)
  .then(result => alt.log("rpc result:", result))
  .catch(e => alt.logError("something went wrong", e.stack))
```
