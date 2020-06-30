import * as fs from "fs";

export default (sources: { url: string, [key: string]: any }[]): Promise<{ css: string }[]> =>
  sources.reduce((accum, next) =>
    accum.then(others =>
      new Promise<string>(((resolve, reject) => {
        fs.readFile(next.url, {encoding: "utf-8"}, ((err, data) => resolve(data)))
      })).then(css => ([
        ...others,
        {css},
      ]))), Promise.resolve([] as { css: string }[]))
