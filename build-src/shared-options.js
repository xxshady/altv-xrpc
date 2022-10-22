import { exec } from "child_process"

export const getSharedBuildOptions = ({ argv }) => {
  const [,, watchArg] = argv

  const watch = ((watchArg === "-w") 
    ? { 
      onRebuild: typesGenerator()
    }
    : false
  )

  return {
    watch,
    bundle: true,
    target: "esnext",
    logLevel: "info",
    external: ["alt-shared"],
    define: {
      ___DEV_MODE: !!watch,
    }
  } 
}

export const typesGenerator = () => 
  (fail, result) => {
    if (fail?.errors?.length > 0) return
    
    if (typesGenerator.child) {
      typesGenerator.child.kill()
    }

    const child = exec("yarn types")
    typesGenerator.child = child

    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)

    child.stdout.on("data", (chunk) => {
      chunk = chunk + ""
      if (!chunk.startsWith("Done in")) return
      child.kill()
    })

    process.on("SIGINT", () => {
      child.kill()
    })
  }