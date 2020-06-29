import {cssSources} from "./CSSStuff";
import * as fs from "fs";
import * as path from "path";

const fetchCss = require("fetch-css");

const tempFiles = path.resolve(__dirname, '..', 'temp')

fetchCss(cssSources).then((cssFiles: {css: string}[]) => {
  cssFiles.forEach(({css}, index) => {
    const source = cssSources[index];
    fs.writeFileSync(path.resolve(tempFiles, `${source.name}.css` ), css)
  })
})
